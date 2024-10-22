import * as RD from '@devexperts/remote-data-ts'
import { Client as LTCClient, LTCChain } from '@xchainjs/xchain-litecoin'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import { Memo } from '../chain/types'
import * as C from '../clients'
import { FeesService, FeesWithRatesLD, FeesWithRatesRD } from '../utxo/types'
import { Client$ } from './types'

export const createFeesService: (client$: Client$) => FeesService = (client$) => {
  const baseFeesService = C.createFeesService({ client$, chain: LTCChain })

  // state for reloading fees+rates
  const { get$: reloadFeesWithRates$, set: reloadFeesWithRates } = observableState<Memo | undefined>(undefined)

  const loadFees$ = (client: LTCClient, address: string, memo?: string): FeesWithRatesLD => {
    const address$ = address
      ? Rx.of(address) // Use provided address if available
      : Rx.from(client.getAddressAsync()) // Otherwise, use the async method

    return address$.pipe(
      RxOp.switchMap((resolvedAddress) =>
        Rx.from(client.getFeesWithRates({ memo, sender: resolvedAddress })).pipe(
          RxOp.map(RD.success),
          RxOp.catchError((error) => Rx.of(RD.failure(error))),
          RxOp.startWith(RD.pending)
        )
      ),
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
