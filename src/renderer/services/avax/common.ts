import * as RD from '@devexperts/remote-data-ts'
import { AVAXChain, Client } from '@xchainjs/xchain-avax'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { defaultAvaxParams } from '../../../shared/avax/const'
import { isError } from '../../../shared/utils/guard'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { WalletAddress$, ExplorerUrl$ } from '../clients/types'
import { Client$, ClientState, ClientState$ } from '../evm/types'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'

/**
 * Stream to create an observable `AVAXClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `AVAXClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `AVAXClient` will never be created as long as no phrase is available
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
              const client = new Client({
                ...defaultAvaxParams,
                network: network,
                phrase: phrase
              })
              return RD.success(client)
            } catch (error) {
              return RD.failure<Error>(isError(error) ? error : new Error('Failed to create AVAX client'))
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
 * Read-only AVAX client for balance queries without requiring keystore
 * This client can be used for standalone ledger mode to query balances
 */
const readOnlyClientState$: ClientState$ = FP.pipe(
  clientNetwork$,
  RxOp.map((network): ClientState => {
    try {
      // Create client without phrase - only for balance queries
      const client = new Client({
        ...defaultAvaxParams,
        network: network
        // No phrase - this limits functionality to read-only operations
      })
      return RD.success(client)
    } catch (error) {
      return RD.failure<Error>(isError(error) ? error : new Error('Failed to create read-only AVAX client'))
    }
  }),
  RxOp.startWith<ClientState>(RD.pending),
  RxOp.shareReplay(1)
)

const readOnlyClient$: Client$ = readOnlyClientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * Current `Address` depending on selected network
 */
const address$: WalletAddress$ = C.address$(client$, AVAXChain)

/**
 * Current `Address` depending on selected network
 */
const addressUI$: WalletAddress$ = C.addressUI$(client$, AVAXChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, readOnlyClient$, address$, addressUI$, explorerUrl$ }
