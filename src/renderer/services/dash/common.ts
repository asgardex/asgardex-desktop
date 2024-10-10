import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import {
  AssetDASH,
  BitgoProviders,
  DASH_DECIMAL,
  DASHChain,
  ClientKeystore as DashClient,
  defaultDashParams
} from '@xchainjs/xchain-dash'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { blockcypherApiKey } from '../../../shared/api/blockcypher'
import { isError } from '../../../shared/utils/guard'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { ClientState, ClientState$, Client$ } from './types'

//======================
// Block Cypher
//======================

const mainnetBlockcypherProvider = new BlockcypherProvider(
  'https://api.blockcypher.com/v1',
  DASHChain,
  AssetDASH,
  DASH_DECIMAL,
  BlockcypherNetwork.DASH,
  blockcypherApiKey || ''
)
export const BlockcypherDataProviders: UtxoOnlineDataProviders = {
  [Network.Testnet]: undefined,
  [Network.Stagenet]: mainnetBlockcypherProvider,
  [Network.Mainnet]: mainnetBlockcypherProvider
}

/**
 * Stream to create an observable DashClient depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `DashClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `DashClient` will never be created as long as no phrase is available
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
              const dashInitParams = {
                ...defaultDashParams,
                phrase: phrase,
                network: network,
                dataProviders: [BitgoProviders, BlockcypherDataProviders]
              }
              const client = new DashClient(dashInitParams)
              return RD.success(client)
            } catch (error) {
              console.error('Failed to create DASH client', error)
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
 * DASH `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, DASHChain)

/**
 * DASH `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, DASHChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, address$, addressUI$, explorerUrl$ }
