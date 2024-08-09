import Transport from '@ledgerhq/hw-transport'
import TransportNodeHidSingleton from '@ledgerhq/hw-transport-node-hid-singleton'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { TxHash } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import * as E from 'fp-ts/Either'

import { IPCLedgerDepositTxParams, IPCLedgerSendTxParams } from '../../../shared/api/io'
import { LedgerError, LedgerErrorId } from '../../../shared/api/types'
import { chainToString, isSupportedChain } from '../../../shared/utils/chain'
import { isError, isEvmHDMode } from '../../../shared/utils/guard'
import * as ARB from './arb/transaction'
import * as AVAX from './avax/transaction'
import * as BTC from './bitcoin/transaction'
import * as BCH from './bitcoincash/transaction'
import * as BSC from './bsc/transaction'
import * as COSMOS from './cosmos/transaction'
import * as DASH from './dash/transaction'
import * as DOGE from './doge/transaction'
import * as ETH from './ethereum/transaction'
import * as LTC from './litecoin/transaction'
import * as THOR from './thorchain/transaction'

const chainSendFunctions: Record<
  Chain,
  (params: IPCLedgerSendTxParams & { transport: Transport }) => Promise<E.Either<LedgerError, TxHash>>
> = {
  [THORChain]: async ({ transport, network, asset, recipient, amount, memo, walletAccount, walletIndex }) => {
    if (!asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `"nodeUrl" needs to be defined to send Ledger transaction on ${chainToString(THORChain)}`
      })
    }
    return THOR.send({ transport, network, asset, recipient, amount, memo, walletAccount, walletIndex })
  },
  [BTCChain]: async (params) => BTC.send(params),
  [LTCChain]: async (params) => LTC.send(params),
  [BCHChain]: async (params) => BCH.send(params),
  [DOGEChain]: async (params) => DOGE.send(params),
  [DASHChain]: async (params) => DASH.send(params),
  [ETHChain]: async (params) => {
    if (!params.asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(ETHChain)}`
      })
    }
    if (!params.feeOption) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee option needs to be set to send Ledger transaction on ${chainToString(ETHChain)}`
      })
    }
    if (!isEvmHDMode(params.hdMode)) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Invalid EthHDMode set - needed to send Ledger transaction on ${chainToString(ETHChain)}`
      })
    }
    return ETH.send({ ...params, feeOption: params.feeOption, evmHDMode: params.hdMode })
  },
  [AVAXChain]: async (params) => {
    if (!params.asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(AVAXChain)}`
      })
    }
    if (!params.feeOption) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee option needs to be set to send Ledger transaction on ${chainToString(AVAXChain)}`
      })
    }
    if (!isEvmHDMode(params.hdMode)) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Invalid EvmHDMode set - needed to send Ledger transaction on ${chainToString(AVAXChain)}`
      })
    }
    return AVAX.send({ ...params, feeOption: params.feeOption, evmHdMode: params.hdMode })
  },
  [BSCChain]: async (params) => {
    if (!params.asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(BSCChain)}`
      })
    }
    if (!params.feeOption) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee option needs to be set to send Ledger transaction on ${chainToString(BSCChain)}`
      })
    }
    if (!isEvmHDMode(params.hdMode)) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Invalid EvmHDMode set - needed to send Ledger transaction on ${chainToString(BSCChain)}`
      })
    }
    return BSC.send({ ...params, feeOption: params.feeOption, evmHdMode: params.hdMode })
  },
  [ARBChain]: async (params) => {
    if (!params.asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(ARBChain)}`
      })
    }
    if (!params.feeOption) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee option needs to be set to send Ledger transaction on ${chainToString(ARBChain)}`
      })
    }
    if (!isEvmHDMode(params.hdMode)) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Invalid EvmHDMode set - needed to send Ledger transaction on ${chainToString(ARBChain)}`
      })
    }
    return ARB.send({ ...params, feeOption: params.feeOption, evmHDMode: params.hdMode })
  },
  [GAIAChain]: async (params) => {
    if (!params.asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(GAIAChain)}`
      })
    }
    if (!params.feeAmount) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee amount needs to be defined to send Ledger transaction on ${chainToString(GAIAChain)}`
      })
    }
    return COSMOS.send(params)
  }
}

const unsupportedChains: Chain[] = [MAYAChain, KUJIChain]

export const sendTx = async ({
  chain,
  network,
  sender,
  recipient,
  amount,
  asset,
  feeAmount,
  memo,
  feeRate,
  feeOption,
  walletAccount,
  walletIndex,
  nodeUrl,
  hdMode
}: IPCLedgerSendTxParams): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const transport = await TransportNodeHidSingleton.create()

    if (!isSupportedChain(chain) || unsupportedChains.includes(chain)) {
      return E.left({
        errorId: LedgerErrorId.NOT_IMPLEMENTED,
        msg: `${chain} is not supported or enabled for 'sendTx'`
      })
    }

    const sendFunction = chainSendFunctions[chain]
    if (!sendFunction) {
      return E.left({
        errorId: LedgerErrorId.NOT_IMPLEMENTED,
        msg: `${chain} is not supported for 'sendTx'`
      })
    }

    const res = await sendFunction({
      transport,
      chain,
      network,
      sender,
      recipient,
      amount,
      asset,
      feeAmount,
      memo,
      feeRate,
      feeOption,
      walletAccount,
      walletIndex,
      nodeUrl,
      hdMode,
      feeAsset: undefined
    })
    await transport.close()
    return res
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.SEND_TX_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}

const chainDepositFunctions: Record<
  Chain,
  (params: IPCLedgerDepositTxParams & { transport: Transport }) => Promise<E.Either<LedgerError, TxHash>>
> = {
  [THORChain]: async ({ transport, network, asset, amount, memo, walletAccount, walletIndex, nodeUrl }) => {
    if (!nodeUrl) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `"nodeUrl" needs to be defined to send Ledger transaction on ${chainToString(THORChain)}`
      })
    }
    return THOR.deposit({ transport, network, amount, asset, memo, walletAccount, walletIndex })
  },
  [ETHChain]: async ({
    transport,
    network,
    asset,
    router,
    recipient,
    amount,
    memo,
    walletAccount,
    walletIndex,
    feeOption,
    hdMode
  }) => {
    if (!router) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Router address needs to be defined to send Ledger transaction on ${chainToString(ETHChain)}`
      })
    }
    if (!asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(ETHChain)}`
      })
    }
    if (!recipient) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Recipient needs to be defined to send Ledger transaction on ${chainToString(ETHChain)}`
      })
    }
    if (!feeOption) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee option needs to be defined to send Ledger transaction on ${chainToString(ETHChain)}`
      })
    }
    if (!isEvmHDMode(hdMode)) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Invalid EthHDMode set - needed to send Ledger transaction on ${chainToString(ETHChain)}`
      })
    }
    return ETH.deposit({
      asset,
      router,
      transport,
      network,
      amount,
      memo,
      walletAccount,
      walletIndex,
      recipient,
      feeOption,
      evmHDMode: hdMode
    })
  },
  [AVAXChain]: async (params) => {
    if (!params.router) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Router address needs to be defined to send Ledger transaction on ${chainToString(AVAXChain)}`
      })
    }
    if (!params.asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(AVAXChain)}`
      })
    }
    if (!params.recipient) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Recipient needs to be defined to send Ledger transaction on ${chainToString(AVAXChain)}`
      })
    }
    if (!params.feeOption) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee option needs to be defined to send Ledger transaction on ${chainToString(AVAXChain)}`
      })
    }
    if (!isEvmHDMode(params.hdMode)) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Invalid EthHDMode set - needed to send Ledger transaction on ${chainToString(AVAXChain)}`
      })
    }
    return AVAX.deposit({
      ...params,
      asset: params.asset,
      router: params.router,
      transport: params.transport,
      network: params.network,
      amount: params.amount,
      memo: params.memo,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      recipient: params.recipient,
      feeOption: params.feeOption,
      evmHDMode: params.hdMode
    })
  },
  [BSCChain]: async (params) => {
    if (!params.router) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Router address needs to be defined to send Ledger transaction on ${chainToString(BSCChain)}`
      })
    }
    if (!params.asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(BSCChain)}`
      })
    }
    if (!params.recipient) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Recipient needs to be defined to send Ledger transaction on ${chainToString(BSCChain)}`
      })
    }
    if (!params.feeOption) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee option needs to be defined to send Ledger transaction on ${chainToString(BSCChain)}`
      })
    }
    if (!isEvmHDMode(params.hdMode)) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Invalid EthHDMode set - needed to send Ledger transaction on ${chainToString(BSCChain)}`
      })
    }
    return BSC.deposit({
      ...params,
      asset: params.asset,
      router: params.router,
      transport: params.transport,
      network: params.network,
      amount: params.amount,
      memo: params.memo,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      recipient: params.recipient,
      feeOption: params.feeOption,
      evmHdMode: params.hdMode
    })
  }
}

export const deposit = async ({
  chain,
  network,
  asset,
  router,
  recipient,
  amount,
  memo,
  walletAccount,
  walletIndex,
  feeOption,
  nodeUrl,
  hdMode
}: IPCLedgerDepositTxParams): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const transport = await TransportNodeHidSingleton.create()

    if (!isSupportedChain(chain) || unsupportedChains.includes(chain)) {
      return E.left({
        errorId: LedgerErrorId.NOT_IMPLEMENTED,
        msg: `${chain} is not supported or enabled for 'deposit'`
      })
    }

    const depositFunction = chainDepositFunctions[chain]
    if (!depositFunction) {
      return E.left({
        errorId: LedgerErrorId.NOT_IMPLEMENTED,
        msg: `${chain} is not supported for 'deposit'`
      })
    }

    const res = await depositFunction({
      transport,
      chain,
      network,
      asset,
      router,
      recipient,
      amount,
      memo,
      walletAccount,
      walletIndex,
      feeOption,
      nodeUrl,
      hdMode
    })
    await transport.close()
    return res
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.DEPOSIT_TX_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}
