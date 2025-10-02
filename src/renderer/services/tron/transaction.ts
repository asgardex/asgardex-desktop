import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { TRONChain, AssetTRX } from '@xchainjs/xchain-tron'
import { either as E, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { IPCLedgerSendTxParams, ipcLedgerSendTxParamsIO } from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { addressInTRONTRC20Whitelist } from '../../helpers/assetHelper'
import { LiveData } from '../../helpers/rx/liveData'
import { Network$ } from '../app/types'
import * as C from '../clients'
import { ApiError, ErrorId, TxHashLD } from '../wallet/types'
import {
  ApproveParams,
  Client$,
  Client as TronClient,
  IsApproveParams,
  IsApprovedLD,
  SendTxParams,
  TransactionService
} from './types'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)

  const runApproveTRC20Token$ = (
    client: TronClient,
    { walletIndex, contractAddress, spenderAddress }: ApproveParams
  ): TxHashLD => {
    return FP.pipe(
      Rx.from(
        client.approve({
          contractAddress,
          spenderAddress,
          walletIndex
        })
      ),
      RxOp.map(RD.success),
      RxOp.catchError(
        (error): TxHashLD =>
          Rx.of(
            RD.failure({
              msg: error?.message ?? error.toString(),
              errorId: ErrorId.APPROVE_TX
            })
          )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const ipcParams: IPCLedgerSendTxParams = {
      chain: TRONChain,
      network,
      asset: params.asset,
      feeAsset: AssetTRX, // TRON uses TRX for fees
      amount: params.amount,
      sender: params.sender,
      recipient: params.recipient,
      memo: params.memo,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      feeRate: NaN,
      feeOption: params.feeOption,
      feeAmount: undefined,
      nodeUrl: undefined,
      hdMode: params.hdMode,
      apiKey: undefined,
      destinationTag: undefined // TRON doesn't need API key
    }

    const encoded = ipcLedgerSendTxParamsIO.encode(ipcParams)

    return FP.pipe(
      Rx.from(window.apiHDWallet.sendLedgerTx(encoded)),
      RxOp.switchMap(
        FP.flow(
          E.fold<LedgerError, TxHash, TxHashLD>(
            ({ msg }) =>
              Rx.of(
                RD.failure({
                  errorId: ErrorId.SEND_LEDGER_TX,
                  msg: `Sending Ledger TRON tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  const approveTRC20Token$ = (params: ApproveParams): TxHashLD => {
    const { contractAddress, network, walletType } = params
    // Check contract address before approving
    if (network === Network.Mainnet && !addressInTRONTRC20Whitelist(contractAddress)) {
      return Rx.of(
        RD.failure({
          msg: `Contract address ${contractAddress} is not whitelisted`,
          errorId: ErrorId.APPROVE_TX
        })
      )
    }

    // For Ledger transactions, we would need specific TRON Ledger support
    // Currently using the common client approach
    if (isLedgerWallet(walletType)) {
      return Rx.of(
        RD.failure({
          msg: 'Ledger TRC20 approval not yet supported',
          errorId: ErrorId.APPROVE_TX
        })
      )
    }

    return client$.pipe(
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => runApproveTRC20Token$(client, params)
          )
        )
      )
    )
  }

  const runIsApprovedTRC20Token$ = (
    client: TronClient,
    { contractAddress, spenderAddress }: IsApproveParams
  ): LiveData<ApiError, boolean> => {
    return FP.pipe(
      Rx.from(
        client.isApproved({
          contractAddress,
          spenderAddress
        })
      ),
      RxOp.map(RD.success),
      RxOp.catchError(
        (error): LiveData<ApiError, boolean> =>
          Rx.of(
            RD.failure({
              msg: error?.message ?? error.toString(),
              errorId: ErrorId.APPROVE_TX
            })
          )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  const isApprovedTRC20Token$ = (params: IsApproveParams): IsApprovedLD =>
    client$.pipe(
      RxOp.debounceTime(300),
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => runIsApprovedTRC20Token$(client, params)
          )
        )
      )
    )

  const sendTx = (params: SendTxParams): TxHashLD =>
    FP.pipe(
      network$,
      RxOp.take(1),
      RxOp.switchMap((network) => {
        if (isLedgerWallet(params.walletType)) return sendLedgerTx({ network, params })

        return common.sendTx(params)
      })
    )

  return {
    ...common,
    sendTx,
    approveTRC20Token$,
    isApprovedTRC20Token$
  }
}
