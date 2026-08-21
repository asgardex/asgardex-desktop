import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { DepositParam, getDenom, RUNE_DENOM, THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset } from '@xchainjs/xchain-util'
import { either as E, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import {
  IPCLedgerDepositTxParams,
  ipcLedgerDepositTxParamsIO,
  IPCLedgerSendTxParams,
  ipcLedgerSendTxParamsIO
} from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { resolveThornodeApiUrl } from '../../../shared/thorchain/const'
import { isLedgerWallet, isVultisigWallet } from '../../../shared/utils/guard'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { createVultisigCosmosTx } from '../cosmos/vultisigTx'
import { TxHashLD, ErrorId } from '../wallet/types'
import { ClientUrl, TransactionService, Client$, ClientUrl$, SendTxParams } from './types'

export const createTransactionService = (
  client$: Client$,
  network$: Network$,
  clientUrl$: ClientUrl$
): TransactionService => {
  const common = C.createTransactionService(client$)

  const depositLedgerTx = ({
    network,
    clientUrl,
    params
  }: {
    network: Network
    clientUrl: ClientUrl
    params: DepositParam & {
      walletAccount: number
      walletIndex: number /* override walletIndex of DepositParam to avoid 'undefined' */
      hdMode: HDMode
    }
  }) => {
    const depositLedgerTxParams: IPCLedgerDepositTxParams = {
      chain: THORChain,
      network,
      asset: params.asset,
      amount: params.amount,
      memo: params.memo,
      recipient: undefined,
      router: undefined,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      feeOption: undefined,
      nodeUrl: resolveThornodeApiUrl(clientUrl[network].node, network),
      hdMode: params.hdMode,
      apiKey: undefined,
      evmRpcUrl: undefined,
      gasMultiplier: undefined
    }
    const encoded = ipcLedgerDepositTxParamsIO.encode(depositLedgerTxParams)
    return FP.pipe(
      Rx.from(window.apiHDWallet.depositLedgerTx(encoded)),
      RxOp.switchMap(
        FP.flow(
          E.fold<LedgerError, TxHash, TxHashLD>(
            ({ msg }) =>
              Rx.of(
                RD.failure({
                  errorId: ErrorId.DEPOSIT_LEDGER_TX_ERROR,
                  msg: `Deposit Ledger THOR tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  /**
   * Sends a deposit request by given `DepositParam`.
   * No auto-retry: deposit already broadcasts; retrying on RPC timeout can resend funds.
   */
  const depositTx = (params: DepositParam): TxHashLD =>
    client$.pipe(
      // Avoid restarting an in-flight deposit if client$ re-emits.
      RxOp.take(1),
      RxOp.switchMap(
        (oClient): TxHashLD =>
          FP.pipe(
            oClient,
            O.fold(
              () =>
                Rx.of(
                  RD.failure({
                    errorId: ErrorId.SEND_TX,
                    msg: 'THOR client not ready'
                  })
                ),
              (client) =>
                Rx.from(client.deposit(params)).pipe(
                  RxOp.map(RD.success),
                  RxOp.catchError((e) =>
                    Rx.of(
                      RD.failure({
                        msg: e?.message ?? e.toString(),
                        errorId: ErrorId.SEND_TX
                      })
                    )
                  )
                )
            )
          )
      ),
      RxOp.startWith(RD.pending)
    )

  const sendPoolTx = ({
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    asset,
    amount,
    memo
  }: DepositParam & {
    walletType: WalletType
    hdMode: HDMode
    walletAccount: number
    walletIndex: number /* override walletIndex of DepositParam to avoid 'undefined' */
  }) =>
    FP.pipe(
      Rx.combineLatest([network$, clientUrl$]),
      RxOp.switchMap(([network, clientUrl]) => {
        if (isLedgerWallet(walletType))
          return depositLedgerTx({
            network,
            clientUrl,
            params: { walletAccount, walletIndex, hdMode, asset, amount, memo }
          })
        if (isVultisigWallet(walletType)) {
          if (!asset) return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'No asset provided for THOR deposit' }))
          return vultisigTx({ network, params: { amount, asset: asset as AnyAsset, memo } })
        }
        return depositTx({ walletIndex, asset, amount, memo })
      })
    )

  const sendLedgerTx = ({
    network,
    clientUrl,
    params
  }: {
    network: Network
    clientUrl: ClientUrl
    params: SendTxParams
  }): TxHashLD => {
    const sendLedgerTxParams: IPCLedgerSendTxParams = {
      chain: THORChain,
      network,
      asset: params.asset,
      feeAsset: undefined,
      amount: params.amount,
      sender: params.sender,
      recipient: params.recipient,
      memo: params.memo,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      feeRate: NaN,
      feeOption: undefined,
      feeAmount: undefined,
      nodeUrl: resolveThornodeApiUrl(clientUrl[network].node, network),
      hdMode: 'default',
      apiKey: undefined,
      destinationTag: undefined,
      evmRpcUrl: undefined,
      gasMultiplier: undefined,
      sendMax: undefined
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
                  msg: `Sending Ledger THOR tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  // Vultisig transaction handler — SDK native pipeline
  const vultisigTx = createVultisigCosmosTx('THOR', getDenom, RUNE_DENOM)
  const sendVultisigTx = ({
    network,
    params
  }: {
    network: Network
    clientUrl: ClientUrl
    params: SendTxParams
  }): TxHashLD => vultisigTx({ network, params })

  const sendTx = (params: SendTxParams) =>
    FP.pipe(
      Rx.combineLatest([network$, clientUrl$]),
      RxOp.switchMap(([network, clientUrl]) => {
        if (isLedgerWallet(params.walletType)) return sendLedgerTx({ network, clientUrl, params })
        if (isVultisigWallet(params.walletType)) return sendVultisigTx({ network, clientUrl, params })

        return common.sendTx(params)
      })
    )

  return {
    ...common,
    sendTx,
    sendPoolTx$: sendPoolTx
  }
}
