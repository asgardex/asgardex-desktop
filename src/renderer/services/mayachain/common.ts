import * as RD from '@devexperts/remote-data-ts'
import { Network as ClientNetwork, Network } from '@xchainjs/xchain-client'
import { Client, getChainId, MAYAChain } from '@xchainjs/xchain-mayachain'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ApiUrls } from '../../../shared/api/types'
import { DEFAULT_MAYANODE_API_URLS, DEFAULT_MAYANODE_RPC_URLS } from '../../../shared/mayachain/const'
import { isError } from '../../../shared/utils/guard'
import { triggerStream } from '../../helpers/stateHelper'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { getStorageState, modifyStorage, mayanodeApi$, mayanodeRpc$ } from '../storage/common'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { Client$, ClientState, ClientState$, ClientUrl$ } from './types'

// `TriggerStream` to reload ClientUrl
const { stream$: reloadClientUrl$, trigger: reloadClientUrl } = triggerStream()

/**
 * Stream of ClientUrl (from storage)
 */
const clientUrl$: ClientUrl$ = FP.pipe(
  Rx.combineLatest([mayanodeApi$, mayanodeRpc$, reloadClientUrl$]),
  RxOp.map(([mayanodeApi, mayanodeRpc, _]) => ({
    [ClientNetwork.Testnet]: {
      node: mayanodeApi.testnet,
      rpc: mayanodeRpc.testnet
    },
    [ClientNetwork.Stagenet]: {
      node: mayanodeApi.stagenet,
      rpc: mayanodeRpc.stagenet
    },
    [ClientNetwork.Mainnet]: {
      node: mayanodeApi.mainnet,
      rpc: mayanodeRpc.mainnet
    }
  })),
  RxOp.distinctUntilChanged()
)

const setMayanodeRpcUrl = (url: string, network: Network) => {
  const current = FP.pipe(
    getStorageState(),
    O.map(({ mayanodeRpc }) => mayanodeRpc),
    O.getOrElse(() => DEFAULT_MAYANODE_RPC_URLS)
  )
  const updated: ApiUrls = { ...current, [network]: url }
  modifyStorage(O.some({ mayanodeRpc: updated }))
}

const setMayanodeApiUrl = (url: string, network: Network) => {
  const current = FP.pipe(
    getStorageState(),
    O.map(({ mayanodeApi }) => mayanodeApi),
    O.getOrElse(() => DEFAULT_MAYANODE_API_URLS)
  )
  const updated: ApiUrls = { ...current, [network]: url }
  modifyStorage(O.some({ mayanodeApi: updated }))
}

/**
 * Stream to create an observable `MayachainClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `MayachainClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `MayachainClient` will never be created as long as no phrase is available
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
                try {
                  const client = new Client({
                    network,
                    phrase
                  })
                  return RD.success(client)
                } catch (error) {
                  return RD.failure<Error>(isError(error) ? error : new Error('Failed to create MAYA client'))
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

const client$: Client$ = clientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * Read-only client stream for standalone ledger mode
 */
const readOnlyClient$: ClientState$ = FP.pipe(
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
                return RD.failure<Error>(isError(error) ? error : new Error('Failed to create read-only MAYA client'))
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

/**
 * `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, MAYAChain)

/**
 * `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, MAYAChain)

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
  setMayanodeRpcUrl,
  setMayanodeApiUrl,
  address$,
  addressUI$,
  explorerUrl$
}
