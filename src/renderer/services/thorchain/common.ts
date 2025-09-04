import * as RD from '@devexperts/remote-data-ts'
import { Network as ClientNetwork, Network } from '@xchainjs/xchain-client'
import { Client, getChainId, THORChain } from '@xchainjs/xchain-thorchain'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ApiUrls } from '../../../shared/api/types'
import { DEFAULT_THORNODE_API_URLS, DEFAULT_THORNODE_RPC_URLS } from '../../../shared/thorchain/const'
import { isError } from '../../../shared/utils/guard'
import { triggerStream } from '../../helpers/stateHelper'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { getStorageState, thornodeApi$, modifyStorage, thornodeRpc$ } from '../storage/common'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { Client$, ClientState, ClientState$, ClientUrl$ } from './types'

// `TriggerStream` to reload ClientUrl
const { stream$: reloadClientUrl$, trigger: reloadClientUrl } = triggerStream()

/**
 * Stream of ClientUrl (from storage)
 */
const clientUrl$: ClientUrl$ = FP.pipe(
  Rx.combineLatest([thornodeApi$, thornodeRpc$, reloadClientUrl$]),
  RxOp.map(([thornodeApi, thornodeRpc, _]) => ({
    [ClientNetwork.Testnet]: {
      node: thornodeApi.testnet,
      rpc: thornodeRpc.testnet
    },
    [ClientNetwork.Stagenet]: {
      node: thornodeApi.stagenet,
      rpc: thornodeRpc.stagenet
    },
    [ClientNetwork.Mainnet]: {
      node: thornodeApi.mainnet,
      rpc: thornodeRpc.mainnet
    }
  })),
  RxOp.distinctUntilChanged()
)

const setThornodeRpcUrl = (url: string, network: Network) => {
  const current = FP.pipe(
    getStorageState(),
    O.map(({ thornodeRpc }) => thornodeRpc),
    O.getOrElse(() => DEFAULT_THORNODE_RPC_URLS)
  )
  const updated: ApiUrls = { ...current, [network]: url }
  modifyStorage(O.some({ thornodeRpc: updated }))
}

const setThornodeApiUrl = (url: string, network: Network) => {
  const current = FP.pipe(
    getStorageState(),
    O.map(({ thornodeApi }) => thornodeApi),
    O.getOrElse(() => DEFAULT_THORNODE_API_URLS)
  )
  const updated: ApiUrls = { ...current, [network]: url }
  modifyStorage(O.some({ thornodeApi: updated }))
}

/**
 * Stream to create an observable `ThorchainClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `ThorchainClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `ThorchainClient` will never be created as long as no phrase is available
 */
const clientState$: ClientState$ = FP.pipe(
  Rx.combineLatest([keystoreService.keystoreState$, clientNetwork$, clientUrl$]),
  RxOp.switchMap(
    ([keystore, network, clientUrl]): ClientState$ =>
      FP.pipe(
        // request chain id from node whenever network or keystore state have been changed
        Rx.from(getChainId(clientUrl[network].node)),
        RxOp.switchMap(() =>
          Rx.of(
            FP.pipe(
              getPhrase(keystore),
              O.map<string, ClientState>((phrase) => {
                const getDefaultClientUrls = (): Record<Network, string[]> => {
                  return {
                    [Network.Testnet]: [clientUrl[Network.Testnet].rpc],
                    [Network.Stagenet]: [clientUrl[Network.Stagenet].rpc],
                    [Network.Mainnet]: [clientUrl[Network.Mainnet].rpc]
                  }
                }
                try {
                  const client = new Client({
                    clientUrls: getDefaultClientUrls(),
                    network,
                    phrase
                  })
                  return RD.success(client)
                } catch (error) {
                  return RD.failure<Error>(isError(error) ? error : new Error('Failed to create THOR client'))
                }
              }),
              // Set back to `initial` if no phrase is available (locked wallet)
              O.getOrElse<ClientState>(() => RD.initial)
            )
          )
        )
      )
  ),
  RxOp.startWith(RD.initial),
  RxOp.shareReplay(1)
)

/**
 * Read-only client for fetching data without requiring keystore phrase
 * This client can fetch balances but cannot send transactions
 */
const readOnlyClientState$: ClientState$ = FP.pipe(
  Rx.combineLatest([clientNetwork$, clientUrl$]),
  RxOp.switchMap(
    ([network, clientUrl]): ClientState$ =>
      FP.pipe(
        // request chain id from node whenever network changes
        Rx.from(getChainId(clientUrl[network].node)),
        RxOp.switchMap(() =>
          Rx.of(
            (() => {
              const getDefaultClientUrls = (): Record<Network, string[]> => {
                return {
                  [Network.Testnet]: [clientUrl[Network.Testnet].rpc],
                  [Network.Stagenet]: [clientUrl[Network.Stagenet].rpc],
                  [Network.Mainnet]: [clientUrl[Network.Mainnet].rpc]
                }
              }
              try {
                // Create client without phrase for read-only operations
                const readOnlyClient = new Client({
                  clientUrls: getDefaultClientUrls(),
                  network
                  // No phrase - this limits functionality to read-only operations
                })
                return RD.success(readOnlyClient)
              } catch (error) {
                return RD.failure<Error>(isError(error) ? error : new Error('Failed to create read-only THOR client'))
              }
            })()
          )
        ),
        RxOp.catchError((error) => Rx.of(RD.failure<Error>(isError(error) ? error : new Error('Unknown error'))))
      )
  ),
  RxOp.startWith(RD.initial),
  RxOp.shareReplay(1)
)

const readOnlyClient$ = readOnlyClientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

const client$: Client$ = clientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, THORChain)

/**
 * `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, THORChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export {
  client$,
  clientState$,
  readOnlyClient$,
  clientUrl$,
  reloadClientUrl,
  setThornodeRpcUrl,
  setThornodeApiUrl,
  address$,
  addressUI$,
  explorerUrl$
}
