import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Client as DogeClient, defaultDogeParams, DOGEChain, AssetDOGE, BitgoProviders } from '@xchainjs/xchain-doge'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import { Observable } from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { blockcypherApiKey, blockcypherUrl } from '../../../shared/api/blockcypher'
import { getKeystoreDerivation } from '../../../shared/utils/derivationPath'
import { isError } from '../../../shared/utils/guard'
import { DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS } from '../../../shared/wallet/types'
import { logger } from '../../helpers/logger'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreService } from '../wallet/keystore'
import { keystoreChainHDSettings$ } from '../wallet/keystoreHDSettings'
import { getPhrase } from '../wallet/util'
import { ClientState, ClientState$ } from './types'

const hdSettings$ = keystoreChainHDSettings$(DOGEChain)

/**
 * Stream to create an observable DogeClient depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `DogeClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `DogeClient` will never be created as long as no phrase is available
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
              const testnetBlockcypherProvider = new BlockcypherProvider(
                blockcypherUrl,
                DOGEChain,
                AssetDOGE,
                8,
                BlockcypherNetwork.DOGE,
                blockcypherApiKey || ''
              )
              const mainnetBlockcypherProvider = new BlockcypherProvider(
                blockcypherUrl,
                DOGEChain,
                AssetDOGE,
                8,
                BlockcypherNetwork.DOGE,
                blockcypherApiKey || ''
              )
              const BlockcypherDataProviders: UtxoOnlineDataProviders = {
                [Network.Testnet]: testnetBlockcypherProvider,
                [Network.Stagenet]: mainnetBlockcypherProvider,
                [Network.Mainnet]: mainnetBlockcypherProvider
              }
              const { rootDerivationPaths } = getKeystoreDerivation(DOGEChain, hdSettings)
              const dogeInitParams = {
                ...defaultDogeParams,
                network: network,
                dataProviders: [BlockcypherDataProviders, BitgoProviders],
                phrase: phrase,
                rootDerivationPaths
              }
              const client = new DogeClient(dogeInitParams)
              return RD.success(client)
            } catch (error) {
              logger.error('Failed to create DOGE client', error)
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

const client$: Observable<O.Option<DogeClient>> = clientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * Read-only DOGE client for balance queries without requiring keystore
 * This client can be used for standalone ledger mode to query balances
 */
const readOnlyClientState$: ClientState$ = FP.pipe(
  clientNetwork$,
  RxOp.map((network) => {
    try {
      const testnetBlockcypherProvider = new BlockcypherProvider(
        blockcypherUrl,
        DOGEChain,
        AssetDOGE,
        8,
        BlockcypherNetwork.DOGE,
        blockcypherApiKey || ''
      )
      const mainnetBlockcypherProvider = new BlockcypherProvider(
        blockcypherUrl,
        DOGEChain,
        AssetDOGE,
        8,
        BlockcypherNetwork.DOGE,
        blockcypherApiKey || ''
      )
      const BlockcypherDataProviders: UtxoOnlineDataProviders = {
        [Network.Testnet]: testnetBlockcypherProvider,
        [Network.Stagenet]: mainnetBlockcypherProvider,
        [Network.Mainnet]: mainnetBlockcypherProvider
      }
      // Create client without phrase - only for balance queries
      const dogeInitParams = {
        ...defaultDogeParams,
        network: network,
        dataProviders: [BlockcypherDataProviders, BitgoProviders]
        // No phrase - this limits functionality to read-only operations
      }
      const client = new DogeClient(dogeInitParams)
      return RD.success(client)
    } catch (error) {
      return RD.failure<Error>(isError(error) ? error : new Error('Failed to create read-only DOGE client'))
    }
  }),
  RxOp.startWith<ClientState>(RD.pending),
  RxOp.shareReplay(1)
)

const readOnlyClient$: Observable<O.Option<DogeClient>> = readOnlyClientState$.pipe(
  RxOp.map(RD.toOption),
  RxOp.shareReplay(1)
)

/**
 * DOGE `Address`
 */
const addressHDSettings$ = hdSettings$.pipe(
  RxOp.map((s) => {
    const { walletIndex } = getKeystoreDerivation(DOGEChain, s ?? DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS)
    return { hdMode: s.hdMode, account: s.account, index: walletIndex }
  })
)

const address$: C.WalletAddress$ = C.address$(client$, DOGEChain, addressHDSettings$)

/**
 * DOGE `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, DOGEChain, addressHDSettings$)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, readOnlyClient$, address$, addressUI$, explorerUrl$ }
