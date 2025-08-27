import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { triggerStream } from '../../helpers/stateHelper'
import * as C from '../clients'
import { Client$, FeesService } from './types'

export const createFeesService = ({ client$ }: { client$: Client$; chain: Chain }): FeesService => {
  const { stream$: reloadFees$, trigger: reloadFees } = triggerStream()

  const fees$ = (): C.FeesLD =>
    Rx.combineLatest([reloadFees$, client$]).pipe(
      RxOp.switchMap(([_, oClient]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.failure(new Error('COSMOS client not found'))),
            (client) => {
              // Use direct getFees call like THORChain to support standalone ledger mode
              // This bypasses the getAddressAsync() call that fails in ledger-only mode
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
