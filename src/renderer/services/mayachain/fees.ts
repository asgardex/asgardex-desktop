import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { triggerStream } from '../../helpers/stateHelper'
import { FeesLD } from '../clients'
import { Client$, FeesService } from './types'

/**
 * Custom `FeesService` for Mayachain
 * Handles standalone ledger mode by not requiring a sender address
 */
export const createFeesService = ({ client$ }: { client$: Client$; chain: Chain }): FeesService => {
  const { stream$: reloadFees$, trigger: reloadFees } = triggerStream()

  const fees$ = (): FeesLD =>
    Rx.combineLatest([reloadFees$, client$]).pipe(
      RxOp.switchMap(([_, oClient]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.failure(new Error('Client not found'))),
            (client) => {
              // Mayachain uses flat fees, no sender address required
              return Rx.from(client.getFees()).pipe(
                RxOp.map(RD.success),
                RxOp.catchError((error) => Rx.of(RD.failure(error)))
              )
            }
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )

  return {
    fees$,
    reloadFees
  }
}
