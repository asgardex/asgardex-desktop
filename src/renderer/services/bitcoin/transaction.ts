import * as RD from '@devexperts/remote-data-ts'
import { BTCChain, Client } from '@xchainjs/xchain-bitcoin'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { either as E, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { blockcypherApiKey } from '../../../shared/api/blockcypher'
import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { AssetBTC } from '../../../shared/utils/asset'
import { isLedgerWallet, isVultisigWallet } from '../../../shared/utils/guard'
import { getUtxoErrorMessage } from '../../helpers/utxoErrorHelper'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { SendTxParams, TransactionService } from '../utxo/types'
import { createVultisigUtxoTx } from '../utxo/vultisigTx'
import { TxHashLD, ErrorId } from '../wallet/types'
import { Client$ } from './types'

export const createTransactionService = (
  client$: Client$,
  clientTR$: Client$,
  network$: Network$
): TransactionService => {
  const common = C.createTransactionService(client$)
  // `commonTR` mirrors `common` but with the Taproot keystore client. Of the
  // services it exposes, only `sendTx`/`subscribeTx` are derivation-sensitive
  // (they sign + broadcast a tx, so they need the right private key). The rest
  // — `txs$`, `tx$`, `txStatus$`, `txRD$`, `resetTx` — are returned from `common`
  // via the `{ ...common, ... }` spread at the end of this function. That's
  // correct because:
  //   • `txs$` / `tx$` ask the data provider for transactions of a given
  //     `walletAddress` / `txHash`; the result depends on the address/hash the
  //     caller passes in, not on the client's `addressFormat`.
  //   • `txStatus$` polls a tx by hash.
  //   • `txRD$` / `resetTx` track the last-sent-tx-hash state in memory.
  // So a single client suffices for those — both `bc1q…` and `bc1p…` queries
  // resolve correctly when their address is passed through.
  const commonTR = C.createTransactionService(clientTR$)

  // Pick the keystore client matching the sender's derivation: Taproot (P2TR) or
  // the default Native SegWit (P2WPKH) client.
  const keystoreClientByHDMode$ = (params: SendTxParams): Client$ => (params.hdMode === 'p2tr' ? clientTR$ : client$)

  const sendKeystoreMaxTx = (params: SendTxParams): TxHashLD =>
    FP.pipe(
      keystoreClientByHDMode$(params),
      RxOp.switchMap(FP.flow(O.fold<Client, Rx.Observable<Client>>(() => Rx.EMPTY, Rx.of))),
      RxOp.switchMap((client) =>
        Rx.from(
          client.transferMax({
            recipient: params.recipient,
            memo: params.memo,
            feeRate: params.feeRate,
            walletIndex: params.walletIndex,
            selectedUtxos: params.selectedUtxos,
            utxoSelectionPreferences: params.utxoSelectionPreferences
          })
        )
      ),
      RxOp.map((result: { hash: string }) => RD.success(result.hash)),
      RxOp.catchError((e): TxHashLD => {
        const msg = getUtxoErrorMessage(e) ?? e?.message ?? e.toString()
        return Rx.of(RD.failure({ msg, errorId: ErrorId.SEND_TX }))
      }),
      RxOp.startWith(RD.pending)
    )

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const {
      amount,
      sender,
      recipient,
      memo,
      walletAccount,
      walletIndex,
      feeRate,
      feeOption,
      hdMode,
      sendMax,
      selectedUtxos,
      utxoSelectionPreferences
    } = params
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: BTCChain,
      asset: AssetBTC,
      feeAsset: undefined,
      network,
      amount,
      sender,
      feeRate,
      feeOption,
      feeAmount: undefined,
      recipient,
      memo,
      walletAccount,
      walletIndex,
      nodeUrl: undefined,
      hdMode,
      apiKey: blockcypherApiKey,
      destinationTag: undefined,
      evmRpcUrl: undefined,
      gasMultiplier: undefined,
      sendMax,
      selectedUtxos: selectedUtxos?.map(({ hash, index, value }) => ({ hash, index, value })),
      utxoSelectionPreferences
    }

    const encoded = ipcLedgerSendTxParamsIO.encode(sendLedgerTxParams)
    return FP.pipe(
      Rx.from(window.apiHDWallet.sendLedgerTx(encoded)),
      RxOp.switchMap(
        FP.flow(
          E.fold<LedgerError, TxHash, TxHashLD>(
            ({ msg }) =>
              Rx.of(
                RD.failure({
                  errorId: ErrorId.SEND_LEDGER_TX,
                  msg: `Sending Ledger BTC tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  // Vultisig transaction handler - MPC signing for BTC using PSBT
  const sendVultisigTx = createVultisigUtxoTx(client$, 'BTC')

  const sendTx = (params: SendTxParams): TxHashLD =>
    FP.pipe(
      network$,
      RxOp.switchMap((network) => {
        if (isLedgerWallet(params.walletType)) return sendLedgerTx({ network, params })
        if (isVultisigWallet(params.walletType)) return sendVultisigTx({ network, params })

        if (params.sendMax) return sendKeystoreMaxTx(params)

        // Keystore: route Taproot sends to the P2TR client; everything else
        // continues through the Native SegWit (P2WPKH) client.
        const keystoreCommon = params.hdMode === 'p2tr' ? commonTR : common
        return keystoreCommon.sendTx(params)
      })
    )

  /**
   * `subscribeTx` is the fire-and-forget counterpart to `sendTx`: it triggers
   * `client.transfer(params)` and writes the resulting hash into an internal
   * `txRD$` state observable. Today no BTC view actually calls it (`sendTx`
   * drives the send pipeline), but it's part of the exported `TransactionService`
   * surface, so we route it by `hdMode` for parity with `sendTx`. Without this,
   * `subscribeTx({ hdMode: 'p2tr', … })` would silently sign with the SegWit
   * private key.
   *
   * Note: the side-effect of writing to `commonTR.txRD$` lands on the TR-side
   * state observable, which isn't exported. If a future caller wants to observe
   * the result via `txRD$`, the two state streams will need to be merged. For
   * now this just gets the signing right.
   */
  const subscribeTx = (params: SendTxParams): Rx.Subscription =>
    params.hdMode === 'p2tr' ? commonTR.subscribeTx(params) : common.subscribeTx(params)

  return {
    ...common,
    sendTx,
    subscribeTx
  }
}
