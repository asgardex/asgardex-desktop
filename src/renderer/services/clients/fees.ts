import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { triggerStream } from '../../helpers/stateHelper'
import { FeesLD, XChainClient$, FeesService } from './types'

/**
 * Common `FeesService` for (almost) all `Client`s
 * to provide `fees$` + `reloadFees`
 *
 * In some case you might to override it to accept custom params.
 * See `src/renderer/services/ethereum/fees.ts` as an example
 *
 */
export const createFeesService = ({ client$ }: { client$: XChainClient$; chain: Chain }): FeesService => {
  const { stream$: reloadFees$, trigger: reloadFees } = triggerStream()

  const fees$ = (): FeesLD =>
    Rx.combineLatest([reloadFees$, client$]).pipe(
      RxOp.switchMap(([_, oClient]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.failure(new Error('Client not found'))),
            (client) =>
              Rx.from(client.getAddressAsync()).pipe(
                RxOp.switchMap((address) =>
                  Rx.from(client.getFees({ sender: address })).pipe(
                    RxOp.map(RD.success),
                    RxOp.catchError((error) => Rx.of(RD.failure(error)))
                  )
                )
              )
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
