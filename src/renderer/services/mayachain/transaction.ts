import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { CACAO_DENOM, DepositParam, getDenom, MAYAChain } from '@xchainjs/xchain-mayachain'
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
import { isLedgerWallet, isVultisigWallet } from '../../../shared/utils/guard'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { recoverTxHashFromBroadcastTimeout } from '../../helpers/cosmosBroadcastError'
import { createScopedLogger } from '../../helpers/logger'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { createVultisigCosmosTx } from '../cosmos/vultisigTx'
import { ClientUrl } from '../thorchain/types'
import { TxHashLD, ErrorId } from '../wallet/types'
import { TransactionService, Client$, ClientUrl$, SendTxParams } from './types'

const logger = createScopedLogger('mayachain.transaction')

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
      chain: MAYAChain,
      network,
      asset: params.asset,
      amount: params.amount,
      memo: params.memo,
      recipient: undefined,
      router: undefined,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      feeOption: undefined,
      nodeUrl: clientUrl[network].node,
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
                  msg: `Deposit Ledger MAYA tx failed. (${msg})`
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
                    msg: 'MAYA client not ready'
                  })
                ),
              (client) =>
                Rx.from(client.deposit(params)).pipe(
                  RxOp.map(RD.success),
                  RxOp.catchError((e) => {
                    // CosmJS inclusion-poll timeout after a successful submit — treat as success.
                    const recovered = recoverTxHashFromBroadcastTimeout(e)
                    if (recovered) {
                      logger.warn('Deposit broadcast confirmation timed out; using submitted tx hash', {
                        txHash: recovered.txHash,
                        message: recovered.message
                      })
                      return Rx.of(RD.success(recovered.txHash))
                    }
                    return Rx.of(
                      RD.failure({
                        msg: e?.message ?? e.toString(),
                        errorId: ErrorId.SEND_TX
                      })
                    )
                  })
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
          if (!asset) return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'No asset provided for MAYA deposit' }))
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
      chain: MAYAChain,
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
      nodeUrl: clientUrl[network].node,
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
                  msg: `Sending Ledger MAYA tx failed. (${msg})`
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
  const vultisigTx = createVultisigCosmosTx('MAYA', getDenom, CACAO_DENOM)
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
