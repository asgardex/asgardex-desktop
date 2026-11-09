import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import { FeesLD } from '../clients'
import { Client$, FeesService } from './types'

/**
 * Network fee *estimate* (daemon fee-per-byte × typical tx weight).
 * Informational only — XMR is watch-only, this is not used to build or send a transaction.
 */
export const createFeesService = (client$: Client$): FeesService => {
  const { get$: reloadFees$, set: setReloadFees } = observableState<boolean>(false)

  const fees$ = (): FeesLD =>
    Rx.combineLatest([reloadFees$, client$]).pipe(
      RxOp.switchMap(([_, oClient]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.EMPTY, // no client yet
            (client) => Rx.from(client.getFees())
          )
        )
      ),
      RxOp.map(RD.success),
      RxOp.catchError((error) => Rx.of(RD.failure(error))),
      RxOp.startWith(RD.pending)
    )

  const reloadFees = () => setReloadFees(true)

  return { fees$, reloadFees }
}
