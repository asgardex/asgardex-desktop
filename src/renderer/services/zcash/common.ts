import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { NownodesProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import {
  Client,
  defaultZECParams,
  ZECChain,
  AssetZEC,
  ZEC_DECIMAL,
  zcashExplorerProviders
} from '@xchainjs/xchain-zcash'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isError } from '../../../shared/utils/guard'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { Client$, ClientState, ClientState$ } from './types'

const LOWER_FEE_BOUND = 10000
const UPPER_FEE_BOUND = 100000

/**
 * Stream to create an observable ZcashClient depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `ZcashClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `ZcashClient` will never be created as long as no phrase is available
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
              // Create custom data provider with API key
              const apiKey = import.meta.env.VITE_NOWNODES_API_KEY || ''
              const mainnetNownodesProvider = new NownodesProvider(
                'https://zecbook.nownodes.io/api/v2',
                ZECChain,
                AssetZEC,
                ZEC_DECIMAL,
                apiKey
              )

              // Create provider configuration based on network
              // For testnet, we'll skip the provider since Nownodes doesn't support ZEC testnet
              const providers: UtxoOnlineDataProviders[] =
                network === Network.Testnet
                  ? [] // No providers for testnet
                  : [
                      {
                        [Network.Testnet]: undefined,
                        [Network.Stagenet]: mainnetNownodesProvider,
                        [Network.Mainnet]: mainnetNownodesProvider
                      }
                    ]

              const zecInitParams = {
                ...defaultZECParams,
                phrase: phrase,
                network: network,
                explorerProviders: zcashExplorerProviders,
                dataProviders: providers,
                feeBounds: {
                  lower: LOWER_FEE_BOUND,
                  upper: UPPER_FEE_BOUND
                }
              }

              const client = new Client(zecInitParams)
              return RD.success(client)
            } catch (error) {
              console.error('Failed to create ZEC client', error)
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
 * ZEC `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, ZECChain)

/**
 * ZEC `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, ZECChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, address$, addressUI$, explorerUrl$ }
