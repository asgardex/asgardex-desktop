import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Client as SolClient, SOLChain, defaultSolanaParams } from '@xchainjs/xchain-solana'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { envOrDefault } from '../../../shared/utils/env'
import { isError } from '../../../shared/utils/guard'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { Client$, ClientState, ClientState$ } from './types'

const solApiKey = envOrDefault(import.meta.env.VITE_SOL_API_KEY, '')

const defaultClientUrls = (): Record<Network, string[]> => {
  return {
    [Network.Testnet]: ['https://api.testnet.solana.com'],
    [Network.Stagenet]: [`https://devnet.helius-rpc.com/?api-key=${solApiKey}`],
    [Network.Mainnet]: [`https://mainnet.helius-rpc.com/?api-key=${solApiKey}`]
  }
}

/**
 * Stream to create an observable `XrdchainClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `XrdchainClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `XrdchainClient` will never be created as long as no phrase is available
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
              const solInitParams = {
                ...defaultSolanaParams,
                network: network,
                phrase: phrase,
                clientUrls: defaultClientUrls()
              }
              const client = new SolClient(solInitParams)
              return RD.success(client)
            } catch (error) {
              console.error('Failed to create SOL client', error)
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
 * Read-only SOL client for balance queries without requiring keystore
 * This client can be used for standalone ledger mode to query balances
 */
const readOnlyClientState$: ClientState$ = FP.pipe(
  clientNetwork$,
  RxOp.map((network): ClientState => {
    try {
      // Create client without phrase - only for balance queries
      const solInitParams = {
        ...defaultSolanaParams,
        network: network,
        clientUrls: defaultClientUrls()
        // No phrase - this limits functionality to read-only operations
      }
      const client = new SolClient(solInitParams)
      return RD.success(client)
    } catch (error) {
      console.error('Failed to create read-only SOL client', error)
      return RD.failure<Error>(isError(error) ? error : new Error('Failed to create read-only SOL client'))
    }
  }),
  RxOp.startWith<ClientState>(RD.pending),
  RxOp.shareReplay(1)
)

const readOnlyClient$: Client$ = readOnlyClientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, SOLChain)

/**
 * `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, SOLChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, readOnlyClient$, address$, addressUI$, explorerUrl$ }
