import { option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { appWalletService } from '../wallet/appWallet'
import { isStandaloneLedgerMode } from '../wallet/types'

/**
 * Factory to create an enhanced client observable that:
 * 1. Uses keystore client when available (phrase unlocked)
 * 2. Falls back to read-only client for standalone modes (Ledger)
 * 3. Returns O.none when no client is available
 *
 * This centralizes wallet mode switching logic in one place.
 */
export const createEnhancedClient$ = <C>(
  client$: Rx.Observable<O.Option<C>>,
  readOnlyClient$: Rx.Observable<O.Option<C>>
): Rx.Observable<O.Option<C>> =>
  Rx.combineLatest([client$, readOnlyClient$, appWalletService.appWalletState$]).pipe(
    RxOp.map(([keystoreClient, readOnlyClient, appWalletState]) => {
      // Keystore client available (has phrase) - use it
      if (O.isSome(keystoreClient)) {
        return keystoreClient
      }

      // Standalone mode (Ledger) - use read-only client
      if (appWalletState && isStandaloneLedgerMode(appWalletState) && O.isSome(readOnlyClient)) {
        return readOnlyClient
      }

      // No client available
      return O.none
    }),
    RxOp.distinctUntilChanged(),
    RxOp.shareReplay({ bufferSize: 1, refCount: true })
  )
