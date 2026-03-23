import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Client as SuiClient, SUIChain, defaultSuiParams } from '@xchainjs/xchain-sui'
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

const defaultClientUrls = (): Record<Network, string> => {
  return {
    [Network.Testnet]: 'https://fullnode.testnet.sui.io',
    [Network.Stagenet]: 'https://fullnode.devnet.sui.io',
    [Network.Mainnet]: 'https://fullnode.mainnet.sui.io'
  }
}

/**
 * Stream to create an observable `SuiClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `SuiClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `SuiClient` will never be created as long as no phrase is available
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
              const suiInitParams = {
                ...defaultSuiParams,
                network: network,
                phrase: phrase,
                clientUrls: defaultClientUrls()
              }
              const client = new SuiClient(suiInitParams)
              return RD.success(client)
            } catch (error) {
              logger.error('Failed to create SUI client', error)
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
 * Read-only SUI client for balance queries without requiring keystore
 * This client can be used for standalone ledger mode to query balances
 */
const readOnlyClientState$: ClientState$ = FP.pipe(
  clientNetwork$,
  RxOp.map((network): ClientState => {
    try {
      // Create client without phrase - only for balance queries
      const suiInitParams = {
        ...defaultSuiParams,
        network: network,
        clientUrls: defaultClientUrls()
        // No phrase - this limits functionality to read-only operations
      }
      const client = new SuiClient(suiInitParams)
      return RD.success(client)
    } catch (error) {
      logger.error('Failed to create read-only SUI client', error)
      return RD.failure<Error>(isError(error) ? error : new Error('Failed to create read-only SUI client'))
    }
  }),
  RxOp.startWith<ClientState>(RD.pending),
  RxOp.shareReplay(1)
)

const readOnlyClient$: Client$ = readOnlyClientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, SUIChain)

/**
 * `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, SUIChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, readOnlyClient$, address$, addressUI$, explorerUrl$ }
