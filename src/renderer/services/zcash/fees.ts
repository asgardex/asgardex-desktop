import * as RD from '@devexperts/remote-data-ts'
import { Client, ZECChain } from '@xchainjs/xchain-zcash'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import { Memo } from '../chain/types'
import * as C from '../clients'
import { FeesService, FeesWithRatesLD, FeesWithRatesRD } from '../utxo/types'
import { Client$ } from './types'

export const createFeesService = (client$: Client$): FeesService => {
  const baseFeesService = C.createFeesService({ client$, chain: ZECChain })

  // state for reloading fees+rates
  const { get$: reloadFeesWithRates$, set: reloadFeesWithRates } = observableState<Memo | undefined>(undefined)

  /**
   * Observable to load transaction fees
   */
  const loadFees$ = (client: Client, address: string, memo?: string): FeesWithRatesLD => {
    return Rx.from(client.getFees({ sender: address, memo })).pipe(
      RxOp.map((fees) => RD.success({ fees, rates: { fast: 1, fastest: 1, average: 1 } })),
      RxOp.catchError((error) => Rx.of(RD.failure(error))),
      RxOp.startWith(RD.pending)
    )
  }

  /**
   * Transaction fees (memo optional)
   */
  const feesWithRates$ = (address: string, memo?: Memo): FeesWithRatesLD =>
    Rx.combineLatest([client$, reloadFeesWithRates$]).pipe(
      RxOp.switchMap(([oClient, reloadMemo]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of<FeesWithRatesRD>(RD.initial),
            (client) => FP.pipe(loadFees$(client, address, reloadMemo || memo), RxOp.shareReplay(1))
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
