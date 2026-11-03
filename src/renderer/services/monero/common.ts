import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { XMRChain } from '../../../shared/utils/chainIds'
import { isError } from '../../../shared/utils/guard'
import { logger } from '../../helpers/logger'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { createReadOnlyXmrClient, createXmrClient } from './client'
import { xmrConnectionConfig$ } from './config'
import { Client$, ClientState, ClientState$ } from './types'

/**
 * Stream to create an observable `XmrClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore (or connection settings / network changed), a new client is created.
 * Whenever a phrase has been removed, `ClientState` is set to `initial`.
 *
 * The client is used for **watch-only** features (address, balances, history). Sending is not wired.
 */
const clientState$: ClientState$ = FP.pipe(
  Rx.combineLatest([keystoreService.keystoreState$, clientNetwork$, xmrConnectionConfig$]),
  RxOp.switchMap(([keystore, network, config]): ClientState$ =>
    FP.pipe(
      getPhrase(keystore),
      O.fold(
        (): ClientState$ => Rx.of(RD.initial),
        (phrase): ClientState$ =>
          Rx.from(createXmrClient({ phrase, network, config })).pipe(
            RxOp.map((client): ClientState => RD.success(client)),
            RxOp.catchError((error) => {
              logger.error('Failed to create XMR client', error)
              return Rx.of(RD.failure<Error>(isError(error) ? error : new Error('Unknown error')))
            }),
            RxOp.startWith<ClientState>(RD.pending)
          )
      )
    )
  ),
  RxOp.startWith<ClientState>(RD.initial),
  RxOp.shareReplay(1)
)

const client$: Client$ = clientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * Client without phrase. Used for explorer URLs only (nothing wallet-related can be derived without a phrase).
 */
const readOnlyClientState$: ClientState$ = FP.pipe(
  clientNetwork$,
  RxOp.map((network): ClientState => {
    try {
      return RD.success(createReadOnlyXmrClient(network))
    } catch (error) {
      logger.error('Failed to create read-only XMR client', error)
      return RD.failure<Error>(isError(error) ? error : new Error('Failed to create read-only XMR client'))
    }
  }),
  RxOp.startWith<ClientState>(RD.pending),
  RxOp.shareReplay(1)
)

const readOnlyClient$: Client$ = readOnlyClientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, XMRChain)

/**
 * `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, XMRChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(readOnlyClient$)

export { client$, clientState$, readOnlyClient$, address$, addressUI$, explorerUrl$ }
