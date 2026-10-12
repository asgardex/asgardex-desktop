import * as RD from '@devexperts/remote-data-ts'
import { Fees, TxParams } from '@xchainjs/xchain-client'
import { TRONChain } from '@xchainjs/xchain-tron'
import { Address, AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import * as C from '../clients'
import { FeesLD } from '../clients'
import { Client$ } from './types'

/**
 * What a TRON inbound transfer costs. `getFees` on the shared service only
 * receives `{ sender }`, so pass the transfer the client knows how to price.
 */
export type TronPoolInTxFeeParams = {
  asset: AnyAsset
  amount: BaseAmount
  recipient: Address
  memo?: string
}

export const createFeesService = (client$: Client$) => {
  const { fees$, reloadFees } = C.createFeesService({ client$, chain: TRONChain })

  // XChainClient.getFees is typed as `{ sender?, memo? }`. The Tron client
  // prices `TxParams` (asset, amount, recipient, memo) and derives the sender
  // from the keystore phrase.
  const getFees = (client: { getFees: (params?: TxParams) => Promise<Fees> }, params: TxParams) =>
    client.getFees(params)

  const poolInTxFees$ = (params: TronPoolInTxFeeParams): FeesLD =>
    client$.pipe(
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.failure(new Error('Client not found'))),
            (client) =>
              Rx.from(
                getFees(client, {
                  asset: params.asset,
                  amount: params.amount,
                  recipient: params.recipient,
                  memo: params.memo
                })
              ).pipe(
                RxOp.map(RD.success),
                RxOp.catchError((error) => Rx.of(RD.failure(error)))
              )
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )

  return {
    fees$,
    reloadFees,
    poolInTxFees$
  }
}
