import * as RD from '@devexperts/remote-data-ts'
import { Address, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
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
              // Derive the sender address used for fee estimation. Phrase-less
              // clients (the read-only client used in Vultisig / standalone-Ledger
              // mode) throw `'Phrase must be provided'` here. Catch it instead of
              // letting the throw tear down the whole `fees$` stream — otherwise
              // `fees$` never advances past `pending` and fee-gated UI (e.g. the
              // swap "Swap" button) stays disabled. When no sender is available we
              // fall back to a sender-less `getFees()`: chains whose fee is not
              // sender-dependent (e.g. XRP) still return a real fee; sender-
              // dependent chains surface `RD.failure` rather than hanging.
              Rx.from(client.getAddressAsync()).pipe(
                RxOp.map((address): O.Option<Address> => O.some(address)),
                RxOp.catchError(() => Rx.of(O.none as O.Option<Address>)),
                RxOp.switchMap((oSender) =>
                  Rx.from(
                    FP.pipe(
                      oSender,
                      O.fold(
                        () => client.getFees(),
                        (sender) => client.getFees({ sender })
                      )
                    )
                  ).pipe(
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
