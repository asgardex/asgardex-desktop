import * as RD from '@devexperts/remote-data-ts'
import { Client as ThorchainClient } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import { FeesLD } from '../clients'
import { Client$ } from './types'

export const createFeesService = ({ client$ }: { client$: Client$; chain: Chain }) => {
  // State for reloading fees
  const { get$: reloadFees$, set: reloadFees } = observableState<boolean>(false)

  /**
   * Observable to load transaction fees
   */
  const loadFees$ = (client: ThorchainClient): FeesLD => {
    return Rx.from(client.getFees()).pipe(
      RxOp.map(RD.success),
      RxOp.catchError((error) => Rx.of(RD.failure(error))),
      RxOp.startWith(RD.pending)
    )
  }

  /**
   * Transaction fees
   */
  const fees$ = (): FeesLD =>
    Rx.combineLatest([client$, reloadFees$]).pipe(
      RxOp.switchMap(([oClient, _]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.failure(new Error('THORChain client not found'))),
            (client) => loadFees$(client)
          )
        )
      ),
      RxOp.shareReplay(1)
    )

  return {
    fees$,
    reloadFees
  }
}
