import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isError } from '../../../shared/utils/guard'
import { logger } from '../../helpers/logger'
import { isXmrReceiveAcknowledged } from './ack'
import { ViewOnlyXmrClient } from './client'
import { XmrConnectionConfig } from './config'
import { deriveXmrViewKeys, XmrViewKeys } from './derivation'
import { ClientState, ClientState$ } from './types'

/**
 * Derives the view-only keys from the keystore phrase (local computation, **no network access**).
 * This is the one place where the phrase is turned into XMR key material.
 */
export const createViewKeys$ = ({
  phrase$,
  network$
}: {
  phrase$: Rx.Observable<O.Option<string>>
  network$: Rx.Observable<Network>
}): Rx.Observable<O.Option<XmrViewKeys>> =>
  Rx.combineLatest([phrase$, network$]).pipe(
    RxOp.map(([oPhrase, network]) =>
      FP.pipe(
        oPhrase,
        O.chain((phrase) => {
          try {
            return O.some(deriveXmrViewKeys(phrase, network))
          } catch (error) {
            logger.error('Failed to derive XMR view keys', error)
            return O.none
          }
        })
      )
    ),
    RxOp.distinctUntilChanged((a, b) =>
      O.getEq<XmrViewKeys>({ equals: (x, y) => x.address === y.address && x.network === y.network }).equals(a, b)
    ),
    RxOp.shareReplay(1)
  )

/**
 * Receive-only acknowledgement still missing for the current wallet (`O.some(keys)`), or `O.none`.
 * Drives the acknowledgement dialog.
 */
export const createPendingAck$ = ({
  viewKeys$,
  ackVersion$,
  enabled$,
  isAcknowledged = isXmrReceiveAcknowledged
}: {
  viewKeys$: Rx.Observable<O.Option<XmrViewKeys>>
  ackVersion$: Rx.Observable<number>
  /** `true` while the user has enabled the (opt-in) XMR chain */
  enabled$: Rx.Observable<boolean>
  isAcknowledged?: (network: Network, address: string) => boolean
}): Rx.Observable<O.Option<XmrViewKeys>> =>
  Rx.combineLatest([viewKeys$, ackVersion$, enabled$]).pipe(
    RxOp.map(([oKeys, _, enabled]) =>
      FP.pipe(
        oKeys,
        O.filter((keys) => enabled && !isAcknowledged(keys.network, keys.address))
      )
    )
  )

/**
 * Client state. `initial` (no client, no address exposed, no node access; the view keys themselves are derived locally while the
 * wallet is unlocked, see `createViewKeys$`) until the user enabled XMR,
 * a wallet exists AND the user acknowledged the receive-only terms. The client creation itself performs no network request.
 */
export const createClientState$ = ({
  viewKeys$,
  config$,
  ackVersion$,
  enabled$,
  isAcknowledged = isXmrReceiveAcknowledged
}: {
  viewKeys$: Rx.Observable<O.Option<XmrViewKeys>>
  config$: Rx.Observable<XmrConnectionConfig>
  ackVersion$: Rx.Observable<number>
  /** `true` while the user has enabled the (opt-in) XMR chain. Disabled -> no client, so no address, no node access. */
  enabled$: Rx.Observable<boolean>
  isAcknowledged?: (network: Network, address: string) => boolean
}): ClientState$ =>
  Rx.combineLatest([viewKeys$, config$, ackVersion$, enabled$]).pipe(
    RxOp.map(([oKeys, config, _, enabled]): ClientState =>
      FP.pipe(
        oKeys,
        O.filter((keys) => enabled && isAcknowledged(keys.network, keys.address)),
        O.fold(
          (): ClientState => RD.initial,
          (keys): ClientState => {
            try {
              return RD.success(new ViewOnlyXmrClient({ viewKeys: keys, network: keys.network, config }))
            } catch (error) {
              logger.error('Failed to create XMR client', error)
              return RD.failure<Error>(isError(error) ? error : new Error('Unknown error'))
            }
          }
        )
      )
    ),
    RxOp.startWith<ClientState>(RD.initial),
    RxOp.shareReplay(1)
  )
