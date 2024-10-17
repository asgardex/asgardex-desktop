import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetLTC, BitgoProviders, Client, LTCChain, defaultLtcParams } from '@xchainjs/xchain-litecoin'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { blockcypherApiKey } from '../../../shared/api/blockcypher'
import { isError } from '../../../shared/utils/guard'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { Client$, ClientState$, ClientState } from './types'

//======================
// Blockcypher
//======================
const testnetBlockcypherProvider = new BlockcypherProvider(
  'https://api.blockcypher.com/v1',
  LTCChain,
  AssetLTC,
  8,
  BlockcypherNetwork.LTC,
  blockcypherApiKey || ''
)

const mainnetBlockcypherProvider = new BlockcypherProvider(
  'https://api.blockcypher.com/v1',
  LTCChain,
  AssetLTC,
  8,
  BlockcypherNetwork.LTC,
  blockcypherApiKey || ''
)
const BlockcypherDataProviders: UtxoOnlineDataProviders = {
  [Network.Testnet]: testnetBlockcypherProvider,
  [Network.Stagenet]: mainnetBlockcypherProvider,
  [Network.Mainnet]: mainnetBlockcypherProvider
}

/**
 * Stream to create an observable `LitecoinClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `LitecoinClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `LitecoinClient` will never be created as long as no phrase is available
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
              const ltcInitParams = {
                ...defaultLtcParams,
                phrase: phrase,
                network: network,
                dataProviders: [BlockcypherDataProviders, BitgoProviders]
              }
              const client = new Client(ltcInitParams)
              return RD.success(client)
            } catch (error) {
              return RD.failure<Error>(isError(error) ? error : new Error('Failed to create LTC client'))
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
 * `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, LTCChain)

/**
 * `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, LTCChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, address$, addressUI$, explorerUrl$ }
