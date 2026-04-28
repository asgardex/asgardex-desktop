import * as RD from '@devexperts/remote-data-ts'
import { TxParams } from '@xchainjs/xchain-sui'
import { baseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import { FeesLD } from '../clients'
import { Client$, FeesService } from './types'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000000'

export const createFeesService = (client$: Client$): FeesService => {
  const { get$: reloadFees$, set: reloadFees } = observableState<TxParams>({
    amount: baseAmount(1),
    recipient: ZERO_ADDRESS
  })

  // SUI SDK's `client.getFees()` takes no params; `reloadFees$` is kept so
  // consumers can still trigger a refetch via `reloadFees(...)`.
  const fees$ = (_params: TxParams): FeesLD =>
    Rx.combineLatest([reloadFees$, client$]).pipe(
      RxOp.switchMap(([_reloadFeesParams, oClient]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.EMPTY, // If no client, return an empty observable
            (client) => Rx.from(client.getFees())
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
