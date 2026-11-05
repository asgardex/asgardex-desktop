import { Network, TxType } from '@xchainjs/xchain-client'
import { AssetXMR, Balance, Client, defaultXMRParams, Tx, TxsPage } from '@xchainjs/xchain-monero'
import { Address, baseAmount } from '@xchainjs/xchain-util'

import { setXmrBalanceSource } from './balanceSource'
import { getDaemonUrl, KeyValueStorage, XmrConnectionConfig } from './config'
import { XmrViewKeys } from './derivation'
import { lwsGetBalance, lwsGetIncomingTxs, lwsLogin, LwsFetch, XMR_DECIMAL } from './lws'
import { getConfirmedLws } from './lwsConfirmation'
import { scanXmrWallet, ScanDeps, totalReceived } from './scanner'

export const XMR_SEND_DISABLED_MSG = 'Sending Monero (XMR) is not supported yet (receive-only wallet).'

type Deps = {
  storage?: KeyValueStorage
  scanDeps?: ScanDeps
  lwsFetch?: LwsFetch
}

const unsupported = (what: string) => (): never => {
  throw new Error(`${what} is not supported (receive-only Monero wallet)`)
}

/**
 * Receive-only Monero client for ASGARDEX.
 *
 * It extends the SDK `Client` for explorer URLs, address validation and fee estimates, but **never receives the
 * keystore phrase**: the base client has no phrase, no `walletRpcUrls` and no `lwsUrls`. Address, balance and history
 * come from view-only keys (`XmrViewKeys`: private view key + public spend key) via the local scanner or — only for a
 * confirmed server — the LWS client. Everything which could spend (`transfer`, `broadcastTx`, `setPhrase`, wallet-rpc
 * calls) is overridden to throw.
 *
 * Limitation: outgoing spends are invisible (no spend key): the balance is "total received" — unless a confirmed LWS
 * reports spends, which are then subtracted (as reported by the server, not verifiable). `xmrBalanceSource$` tells the UI
 * which of the two it shows.
 */
export class ViewOnlyXmrClient extends Client {
  private readonly viewWallet: XmrViewKeys
  private readonly viewConfig: XmrConnectionConfig
  private readonly viewDeps: Deps
  private lwsRegistered = false

  constructor({
    viewKeys,
    network,
    config,
    deps = {}
  }: {
    viewKeys?: XmrViewKeys
    network: Network
    config: XmrConnectionConfig
    deps?: Deps
  }) {
    const daemonUrls = {
      ...(defaultXMRParams.daemonUrls as Record<Network, string[]>),
      ...(config.daemonUrl ? { [network]: [config.daemonUrl] } : {})
    } as Record<Network, string[]>
    const none = { [Network.Mainnet]: [], [Network.Stagenet]: [], [Network.Testnet]: [] } as Record<Network, string[]>
    super({ ...defaultXMRParams, network, daemonUrls, lwsUrls: none, walletRpcUrls: none })
    if (viewKeys && viewKeys.network !== network) throw new Error('Monero view keys belong to another network')
    this.viewWallet = viewKeys as XmrViewKeys
    this.viewConfig = config
    this.viewDeps = deps
  }

  private requireWallet(): XmrViewKeys {
    if (!this.viewWallet) throw new Error('No Monero wallet available')
    return this.viewWallet
  }

  getAddress(index = 0): string {
    if (index !== 0) throw new Error('Only the primary Monero address (index 0) is supported')
    return this.requireWallet().address
  }

  getAddressAsync(index = 0): Promise<string> {
    return Promise.resolve().then(() => this.getAddress(index))
  }

  private assertOwnAddress(address: Address) {
    if (address !== this.requireWallet().address) {
      throw new Error('Balances and history are only available for the own Monero address')
    }
  }

  /** LWS to use: only a configured server with a valid in-app confirmation for exactly this URL */
  private confirmedLws() {
    return getConfirmedLws(this.requireWallet(), this.viewConfig)
  }

  private async ensureLwsRegistered(lws: NonNullable<ReturnType<ViewOnlyXmrClient['confirmedLws']>>) {
    if (this.lwsRegistered) return
    await lwsLogin(lws, this.requireWallet(), this.viewDeps.lwsFetch)
    this.lwsRegistered = true
  }

  private getStorage(): KeyValueStorage | undefined {
    return this.viewDeps.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
  }

  private async scan() {
    const wallet = this.requireWallet()
    const daemonUrl = getDaemonUrl(this.viewConfig, this.getNetwork())
    if (!daemonUrl) throw new Error('No Monero node configured')
    return scanXmrWallet({
      viewKeys: wallet,
      daemonUrl,
      restoreHeight: this.viewConfig.restoreHeight,
      storage: this.getStorage(),
      deps: this.viewDeps.scanDeps
    })
  }

  async getBalance(address: Address): Promise<Balance[]> {
    this.assertOwnAddress(address)
    const lws = this.confirmedLws()
    if (lws) {
      await this.ensureLwsRegistered(lws)
      const { received, sent } = await lwsGetBalance(lws, this.requireWallet(), this.viewDeps.lwsFetch)
      // Spends are only known from the server (not verifiable without the spend key); never below zero
      const balance = sent === undefined ? received : received > sent ? received - sent : BigInt(0)
      setXmrBalanceSource(sent === undefined ? 'received' : 'lws-reported')
      return [{ asset: AssetXMR, amount: baseAmount(balance.toString(), XMR_DECIMAL) }]
    }
    const state = await this.scan()
    setXmrBalanceSource('received')
    return [{ asset: AssetXMR, amount: baseAmount(totalReceived(state).toString(), XMR_DECIMAL) }]
  }

  async getTransactions(params?: { address?: string; offset?: number; limit?: number }): Promise<TxsPage> {
    const address = params?.address ?? this.requireWallet().address
    this.assertOwnAddress(address)
    const offset = params?.offset ?? 0
    const limit = params?.limit ?? 10

    const lws = this.confirmedLws()
    if (lws) {
      await this.ensureLwsRegistered(lws)
      const txs = await lwsGetIncomingTxs(lws, this.requireWallet(), this.viewDeps.lwsFetch)
      return {
        total: txs.length,
        txs: txs.slice(offset, offset + limit).map((tx): Tx => ({
          asset: AssetXMR,
          date: tx.date,
          type: TxType.Transfer,
          hash: tx.hash,
          from: [],
          to: [{ to: address, amount: tx.amount }]
        }))
      }
    }

    const state = await this.scan()
    const byTx = new Map<string, { amount: bigint; timestamp: number; height: number }>()
    for (const o of state.outputs) {
      const entry = byTx.get(o.txHash)
      if (entry) entry.amount += o.amount
      else byTx.set(o.txHash, { amount: o.amount, timestamp: o.timestamp, height: o.height })
    }
    const all = [...byTx.entries()].sort(([, a], [, b]) => b.height - a.height)
    return {
      total: all.length,
      txs: all.slice(offset, offset + limit).map(([hash, e]): Tx => ({
        asset: AssetXMR,
        date: new Date(e.timestamp * 1000),
        type: TxType.Transfer,
        hash,
        from: [],
        to: [{ to: address, amount: baseAmount(e.amount.toString(), XMR_DECIMAL) }]
      }))
    }
  }

  // --- everything which could spend or needs a phrase is disabled ---
  setPhrase(): string {
    return unsupported('Setting a phrase')()
  }
  transfer(): Promise<string> {
    return Promise.reject(new Error(XMR_SEND_DISABLED_MSG))
  }
  broadcastTx(): Promise<string> {
    return Promise.reject(new Error(XMR_SEND_DISABLED_MSG))
  }
  getWalletBalanceDetail(): Promise<{ total: never; unlocked: never }> {
    return Promise.reject(new Error('Wallet RPC is not supported (receive-only Monero wallet)'))
  }
}

/** Client without any wallet: explorer URLs, address validation and fee estimates only */
export const createReadOnlyXmrClient = (network: Network): ViewOnlyXmrClient =>
  new ViewOnlyXmrClient({ network, config: { daemonUrl: '', lwsUrl: '', lwsConfirmation: null, restoreHeight: null } })
