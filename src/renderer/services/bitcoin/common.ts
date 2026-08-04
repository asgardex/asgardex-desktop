import * as RD from '@devexperts/remote-data-ts'
import {
  AddressFormat,
  AssetBTC,
  BTCChain,
  Client as BitcoinClient,
  BitgoProviders,
  HaskoinDataProviders,
  defaultBTCParams,
  tapRootDerivationPaths
} from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import { Observable } from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { blockcypherApiKey } from '../../../shared/api/blockcypher'
import { getKeystoreDerivation } from '../../../shared/utils/derivationPath'
import { isError } from '../../../shared/utils/guard'
import { DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS, KeystoreChainHDSettings } from '../../../shared/wallet/types'
import { logger } from '../../helpers/logger'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreAddress$, keystoreAddressUI$ } from '../clients/address'
import { keystoreService } from '../wallet/keystore'
import { keystoreChainHDSettings$ } from '../wallet/keystoreHDSettings'
import { getPhrase } from '../wallet/util'
import { ClientState, ClientState$ } from './types'

const LOWER_FEE_BOUND = 1
const UPPER_FEE_BOUND = 2000

//======================
// Blockcypher
//======================
const testnetBlockcypherProvider = new BlockcypherProvider(
  'https://api.blockcypher.com/v1',
  BTCChain,
  AssetBTC,
  8,
  BlockcypherNetwork.BTCTEST,
  blockcypherApiKey || ''
)

const mainnetBlockcypherProvider = new BlockcypherProvider(
  'https://api.blockcypher.com/v1',
  BTCChain,
  AssetBTC,
  8,
  BlockcypherNetwork.BTC,
  blockcypherApiKey || ''
)
const BlockcypherDataProviders: UtxoOnlineDataProviders = {
  [Network.Testnet]: testnetBlockcypherProvider,
  [Network.Stagenet]: mainnetBlockcypherProvider,
  [Network.Mainnet]: mainnetBlockcypherProvider
}

const dataProviders = [BlockcypherDataProviders, HaskoinDataProviders, BitgoProviders]

const feeBounds = { lower: LOWER_FEE_BOUND, upper: UPPER_FEE_BOUND }

const hdSettings$ = keystoreChainHDSettings$(BTCChain)

/**
 * Paths for a BTC address format: use stored account/index (and custom path if set).
 * Each format uses its own BIP84 / BIP86 template unless a custom path is locked.
 */
const pathsForFormat = (addressFormat: AddressFormat, hd: KeystoreChainHDSettings) => {
  const mode = addressFormat === AddressFormat.P2TR ? 'p2tr' : 'p2wpkh'
  // Custom path: apply to both clients (user-supplied full path)
  if (hd.customPath?.trim()) {
    return getKeystoreDerivation(BTCChain, hd)
  }
  return getKeystoreDerivation(BTCChain, { ...hd, hdMode: mode })
}

/**
 * Build a keystore-derived `BitcoinClient` factory bound to a given `AddressFormat`.
 * Uses keystore HD settings (account / index / custom path) so Find my funds can relocate both
 * Native SegWit and Taproot addresses.
 */
const createKeystoreClientState$ = (addressFormat: AddressFormat): ClientState$ =>
  FP.pipe(
    Rx.combineLatest([keystoreService.keystoreState$, clientNetwork$, hdSettings$]),
    RxOp.switchMap(
      ([keystore, network, hdSettings]): ClientState$ =>
        Rx.of(
          FP.pipe(
            getPhrase(keystore),
            O.map<string, ClientState>((phrase) => {
              try {
                const hd = hdSettings ?? DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS
                const { rootDerivationPaths } = pathsForFormat(addressFormat, hd)
                const btcInitParams = {
                  ...defaultBTCParams,
                  phrase,
                  network,
                  dataProviders,
                  addressFormat,
                  rootDerivationPaths:
                    rootDerivationPaths ??
                    (addressFormat === AddressFormat.P2TR
                      ? tapRootDerivationPaths
                      : defaultBTCParams.rootDerivationPaths),
                  feeBounds
                }
                const client = new BitcoinClient(btcInitParams)
                return RD.success(client)
              } catch (error) {
                logger.error(`Failed to create BTC client (addressFormat=${AddressFormat[addressFormat]})`, error)
                return RD.failure<Error>(isError(error) ? error : new Error('Unknown error'))
              }
            }),
            O.getOrElse<ClientState>(() => RD.initial)
          )
        ).pipe(RxOp.startWith(RD.pending))
    ),
    RxOp.startWith<ClientState>(RD.initial),
    RxOp.shareReplay(1)
  )

/**
 * Stream of the Native SegWit (P2WPKH) keystore client — the historical default.
 */
const clientState$: ClientState$ = createKeystoreClientState$(AddressFormat.P2WPKH)

/**
 * Stream of the Taproot (P2TR) keystore client, derived from the same phrase but
 * using the BIP86 taproot derivation paths from `@xchainjs/xchain-bitcoin`.
 */
const clientStateTR$: ClientState$ = createKeystoreClientState$(AddressFormat.P2TR)

const client$: Observable<O.Option<BitcoinClient>> = clientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

const clientTR$: Observable<O.Option<BitcoinClient>> = clientStateTR$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * Read-only BTC client for balance queries without requiring keystore
 * This client can be used for standalone ledger mode to query balances
 */
const readOnlyClientState$: Observable<RD.RemoteData<Error, BitcoinClient>> = FP.pipe(
  clientNetwork$,
  RxOp.map((network) => {
    try {
      // Create client without phrase - only for balance queries
      const btcInitParams = {
        ...defaultBTCParams,
        network: network,
        dataProviders,
        addressFormat: AddressFormat.P2WPKH,
        rootDerivationPaths: defaultBTCParams.rootDerivationPaths,
        feeBounds
      }
      const client = new BitcoinClient(btcInitParams)
      return RD.success(client)
    } catch (error) {
      logger.error('Failed to create read-only BTC client', error)
      return RD.failure<Error>(isError(error) ? error : new Error('Unknown error'))
    }
  }),
  RxOp.startWith<RD.RemoteData<Error, BitcoinClient>>(RD.pending),
  RxOp.shareReplay(1)
)

const readOnlyClient$: Observable<O.Option<BitcoinClient>> = readOnlyClientState$.pipe(
  RxOp.map(RD.toOption),
  RxOp.shareReplay(1)
)

const addressHdSegwit$ = hdSettings$.pipe(
  RxOp.map((s) => {
    const { walletIndex } = pathsForFormat(AddressFormat.P2WPKH, s)
    return { hdMode: 'p2wpkh' as const, account: s.account, index: walletIndex }
  })
)

const addressHdTaproot$ = hdSettings$.pipe(
  RxOp.map((s) => {
    const { walletIndex } = pathsForFormat(AddressFormat.P2TR, s)
    return { hdMode: 'p2tr' as const, account: s.account, index: walletIndex }
  })
)

/**
 * BTC `Address` — Native SegWit (P2WPKH) keystore address (also serves Ledger/Vultisig modes
 * via the unified `addressUI$` resolver).
 */
const address$: C.WalletAddress$ = C.address$(client$, BTCChain, addressHdSegwit$)
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, BTCChain, addressHdSegwit$)

/**
 * BTC `Address` — Taproot (P2TR) keystore address. Keystore-only: this emits `O.none` in
 * Ledger / Vultisig standalone modes (where `clientTR$` is unavailable), so no spurious
 * Taproot row appears for those wallet modes.
 */
const addressTR$: C.WalletAddress$ = keystoreAddress$(clientTR$, BTCChain, addressHdTaproot$)
const addressUITR$: C.WalletAddress$ = keystoreAddressUI$(clientTR$, BTCChain, addressHdTaproot$)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export {
  client$,
  clientState$,
  clientTR$,
  clientStateTR$,
  readOnlyClient$,
  address$,
  addressUI$,
  addressTR$,
  addressUITR$,
  explorerUrl$
}
