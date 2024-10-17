import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Client as DogeClient, defaultDogeParams, DOGEChain, AssetDOGE, BitgoProviders } from '@xchainjs/xchain-doge'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import { Observable } from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { blockcypherApiKey, blockcypherUrl } from '../../../shared/api/blockcypher'
import { isError } from '../../../shared/utils/guard'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { ClientState, ClientState$ } from './types'

/**
 * Stream to create an observable DogeClient depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `DogeClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `DogeClient` will never be created as long as no phrase is available
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
              const dogeInitParams = {
                ...defaultDogeParams,
                network: network,
                dataProviders: [BlockcypherDataProviders, BitgoProviders],
                phrase: phrase
              }
              const client = new DogeClient(dogeInitParams)
              return RD.success(client)
            } catch (error) {
              console.error('Failed to create DOGE client', error)
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
 * DOGE `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, DOGEChain)

/**
 * DOGE `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, DOGEChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, address$, addressUI$, explorerUrl$ }
