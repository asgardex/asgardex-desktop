import * as RD from '@devexperts/remote-data-ts'
import { TxParams } from '@xchainjs/xchain-solana'
import { baseAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import { FeesLD } from '../clients'
import { Client$, FeesService } from './types'

export const ZERO_ADDRESS = '11111111111111111111111111111111'

export const createFeesService = (client$: Client$): FeesService => {
  const { get$: reloadFees$, set: reloadFees } = observableState<TxParams>({
    amount: baseAmount(1),
    recipient: ZERO_ADDRESS
  })

  const fees$ = (params: TxParams): FeesLD =>
    Rx.combineLatest([reloadFees$, client$]).pipe(
      // Switch to a new observable whenever the `reloadFees$` or `client$` emits a value
      RxOp.switchMap(([reloadFeesParams, oClient]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.EMPTY, // If no client, return an empty observable
            (client) => Rx.from(client.getFees(reloadFeesParams || params))
          )
        )
      ),
      RxOp.map(RD.success), // Map the result to `RemoteData.success`
      RxOp.catchError((error) => Rx.of(RD.failure(error))),
      RxOp.startWith(RD.pending) // Start with a `pending` state until the actual value is emitted
    )

  return {
    fees$,
    reloadFees
  }
}
