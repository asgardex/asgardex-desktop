import * as RD from '@devexperts/remote-data-ts'
import { DASHChain, Client as DashClient } from '@xchainjs/xchain-dash'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import { Memo } from '../chain/types'
import * as C from '../clients'
import { FeesService, FeesWithRatesLD } from './types'
import { Client$, FeesWithRatesRD } from './types'

export const createFeesService = (client$: Client$): FeesService => {
  const baseFeesService = C.createFeesService({ client$, chain: DASHChain })

  // state for reloading fees+rates
  const { get$: reloadFeesWithRates$, set: reloadFeesWithRates } = observableState<Memo | undefined>(undefined)

  /**
   * Observable to load transaction fees
   */
  const loadFees$ = (client: DashClient, memo?: string): FeesWithRatesLD =>
    Rx.from(client.getAddressAsync()).pipe(
      RxOp.switchMap((address) =>
        Rx.from(client.getFeesWithRates({ memo, sender: address })).pipe(
          RxOp.map(RD.success),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      ),
      RxOp.startWith(RD.pending)
    )

  /**
   * Transaction fees (memo optional)
   */
  const feesWithRates$ = (memo?: Memo): FeesWithRatesLD =>
    Rx.combineLatest([client$, reloadFeesWithRates$]).pipe(
      RxOp.switchMap(([oClient, reloadMemo]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of<FeesWithRatesRD>(RD.initial),
            (client) => FP.pipe(loadFees$(client, reloadMemo || memo), RxOp.shareReplay(1))
          )
        )
      )
    )

  return {
    ...baseFeesService,
    reloadFeesWithRates,
    feesWithRates$
  }
}
