import * as RD from '@devexperts/remote-data-ts'
import { Client as NearClient, NEARChain, defaultNearParams } from '@xchainjs/xchain-near'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isError } from '../../../shared/utils/guard'
import { logger } from '../../helpers/logger'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { Client$, ClientState, ClientState$ } from './types'

/**
 * Stream to create an observable `NearClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `NearClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `NearClient` will never be created as long as no phrase is available
 */
const clientState$: ClientState$ = FP.pipe(
  Rx.combineLatest([keystoreService.keystoreState$, clientNetwork$]),
  RxOp.switchMap(
    ([keystore, network]): ClientState$ =>
      Rx.of(
        FP.pipe(
          getPhrase(keystore),
          O.map<string, ClientState>((phrase) => {
            try {
              const nearInitParams = {
                ...defaultNearParams,
                network: network,
                phrase: phrase
              }
              const client = new NearClient(nearInitParams)
              return RD.success(client)
            } catch (error) {
              logger.error('Failed to create NEAR client', error)
              return RD.failure<Error>(isError(error) ? error : new Error('Unknown error'))
            }
          }),
          // Set back to `initial` if no phrase is available (locked wallet)
          O.getOrElse<ClientState>(() => RD.initial)
        )
      ).pipe(RxOp.startWith(RD.pending))
  ),
  RxOp.startWith<ClientState>(RD.initial),
  RxOp.shareReplay(1)
)

const client$: Client$ = clientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * Read-only NEAR client for balance queries without requiring keystore
 * This client can be used for standalone ledger mode to query balances
 */
const readOnlyClientState$: ClientState$ = FP.pipe(
  clientNetwork$,
  RxOp.map((network): ClientState => {
    try {
      // Create client without phrase - only for balance queries
      const nearInitParams = {
        ...defaultNearParams,
        network: network
        // No phrase - this limits functionality to read-only operations
      }
      const client = new NearClient(nearInitParams)
      return RD.success(client)
    } catch (error) {
      logger.error('Failed to create read-only NEAR client', error)
      return RD.failure<Error>(isError(error) ? error : new Error('Failed to create read-only NEAR client'))
    }
  }),
  RxOp.startWith<ClientState>(RD.pending),
  RxOp.shareReplay(1)
)

const readOnlyClient$: Client$ = readOnlyClientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, NEARChain)

/**
 * `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, NEARChain)

/**
 * Explorer url depending on selected network
 *
 * Uses the read-only client so the URL stays available when the wallet is locked.
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(readOnlyClient$)

export { client$, clientState$, readOnlyClient$, address$, addressUI$, explorerUrl$ }
