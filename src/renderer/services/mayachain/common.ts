import * as RD from '@devexperts/remote-data-ts'
import { Network as ClientNetwork } from '@xchainjs/xchain-client'
import { Client, getChainId, MAYAChain } from '@xchainjs/xchain-mayachain'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ApiUrls, Network } from '../../../shared/api/types'
import { DEFAULT_MAYANODE_API_URLS, DEFAULT_MAYANODE_RPC_URLS } from '../../../shared/mayachain/const'
import { isError } from '../../../shared/utils/guard'
import { triggerStream } from '../../helpers/stateHelper'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { getStorageState, getStorageState$, modifyStorage } from '../storage/common'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { INITIAL_CHAIN_IDS, DEFAULT_CLIENT_URL } from './const'
import { Client$, ClientState, ClientState$, ClientUrl$ } from './types'

// `TriggerStream` to reload ClientUrl
const { stream$: reloadClientUrl$, trigger: reloadClientUrl } = triggerStream()

/**
 * Stream of ClientUrl (from storage)
 */
const clientUrl$: ClientUrl$ = FP.pipe(
  Rx.combineLatest([getStorageState$, reloadClientUrl$]),
  RxOp.map(([storage]) =>
    FP.pipe(
      storage,
      O.map(({ mayanodeApi, mayanodeRpc }) => ({
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
      O.getOrElse(() => DEFAULT_CLIENT_URL)
    )
  )
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
        RxOp.switchMap((chainId) =>
          Rx.of(
            FP.pipe(
              getPhrase(keystore),
              O.map<string, ClientState>((phrase) => {
                try {
                  const client = new Client({
                    clientUrl,
                    network,
                    phrase,
                    chainIds: { ...INITIAL_CHAIN_IDS, [network]: chainId }
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
        ),
        RxOp.catchError(() =>
          Rx.of(
            FP.pipe(
              getPhrase(keystore),
              O.map<string, ClientState>((phrase) => {
                try {
                  const client = new Client({
                    clientUrl,
                    network,
                    phrase,
                    chainIds: { ...INITIAL_CHAIN_IDS, [network]: INITIAL_CHAIN_IDS }
                  })
                  return RD.success(client)
                } catch (error) {
                  return RD.failure<Error>(isError(error) ? error : new Error('Failed to create MAYA client'))
                }
              }),
              O.getOrElse<ClientState>(() => RD.initial)
            )
          )
        ),
        RxOp.startWith(RD.pending)
      )
  ),
  RxOp.startWith(RD.initial),
  RxOp.shareReplay(1)
)

const client$: Client$ = clientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

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
  clientUrl$,
  reloadClientUrl,
  setMayanodeRpcUrl,
  setMayanodeApiUrl,
  address$,
  addressUI$,
  explorerUrl$
}
