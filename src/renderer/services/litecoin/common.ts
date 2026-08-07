import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetLTC, BitgoProviders, Client, LTCChain, defaultLtcParams } from '@xchainjs/xchain-litecoin'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { blockcypherApiKey } from '../../../shared/api/blockcypher'
import { getKeystoreDerivation } from '../../../shared/utils/derivationPath'
import { isError } from '../../../shared/utils/guard'
import { DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS } from '../../../shared/wallet/types'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreService } from '../wallet/keystore'
import { keystoreChainHDSettings$ } from '../wallet/keystoreHDSettings'
import { getPhrase } from '../wallet/util'
import { Client$, ClientState$, ClientState } from './types'

const hdSettings$ = keystoreChainHDSettings$(LTCChain)

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
  Rx.combineLatest([keystoreService.keystoreState$, clientNetwork$, hdSettings$]),
  RxOp.switchMap(
    ([keystore, network, hdSettings]): ClientState$ =>
      Rx.of(
        FP.pipe(
          getPhrase(keystore),
          O.map<string, ClientState>((phrase) => {
            try {
              const { rootDerivationPaths } = getKeystoreDerivation(LTCChain, hdSettings)
              const ltcInitParams = {
                ...defaultLtcParams,
                phrase: phrase,
                network: network,
                dataProviders: [BlockcypherDataProviders, BitgoProviders],
                rootDerivationPaths
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
 * Read-only LTC client for balance queries without requiring keystore
 * This client can be used for standalone ledger mode to query balances
 */
const readOnlyClientState$: ClientState$ = FP.pipe(
  clientNetwork$,
  RxOp.map((network) => {
    try {
      // Create client without phrase - only for balance queries
      const ltcInitParams = {
        ...defaultLtcParams,
        network: network,
        dataProviders: [BlockcypherDataProviders, BitgoProviders]
        // No phrase - this limits functionality to read-only operations
      }
      const client = new Client(ltcInitParams)
      return RD.success(client)
    } catch (error) {
      return RD.failure<Error>(isError(error) ? error : new Error('Failed to create read-only LTC client'))
    }
  }),
  RxOp.startWith<ClientState>(RD.pending),
  RxOp.shareReplay(1)
)

const readOnlyClient$: Client$ = readOnlyClientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

const addressHDSettings$ = hdSettings$.pipe(
  RxOp.map((s) => {
    const { walletIndex } = getKeystoreDerivation(LTCChain, s ?? DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS)
    return { hdMode: s.hdMode, account: s.account, index: walletIndex }
  })
)

/**
 * `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, LTCChain, addressHDSettings$)

/**
 * `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, LTCChain, addressHDSettings$)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, readOnlyClient$, address$, addressUI$, explorerUrl$ }
