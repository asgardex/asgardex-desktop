import * as RD from '@devexperts/remote-data-ts'
import { Network as ClientNetwork, Network } from '@xchainjs/xchain-client'
import { Client } from '@xchainjs/xchain-mayachain'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ApiUrls } from '../../../shared/api/types'
import { DEFAULT_MAYANODE_API_URLS, DEFAULT_MAYANODE_RPC_URLS } from '../../../shared/mayachain/const'
import { MAYAChain } from '../../../shared/utils/chainIds'
import { getKeystoreDerivation } from '../../../shared/utils/derivationPath'
import { isError } from '../../../shared/utils/guard'
import { DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS } from '../../../shared/wallet/types'
import { triggerStream } from '../../helpers/stateHelper'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { getStorageState, modifyStorage, mayanodeApi$, mayanodeRpc$ } from '../storage/common'
import { keystoreService } from '../wallet/keystore'
import { keystoreChainHDSettings$ } from '../wallet/keystoreHDSettings'
import { getPhrase } from '../wallet/util'
import { getChainIdShared } from './chainId'
import { Client$, ClientState, ClientState$, ClientUrl$ } from './types'

// `TriggerStream` to reload ClientUrl
const { stream$: reloadClientUrl$, trigger: reloadClientUrl } = triggerStream()

// `TriggerStream` to build new MAYA clients (keystore + read-only) with the same urls.
// A `Client` whose first connect failed (e.g. `429`) never connects again, a new one does.
const { stream$: rebuildClient$, trigger: rebuildClient } = triggerStream()

// A node check of a client build failed. `kept`: the last client, kept by a failed rebuild (its balance error
// stays on screen), or none. The balance service marks the client stuck, so the next Refresh builds again.
type CheckFailed = { readOnly: boolean; kept: O.Option<Client> }
const checkFailed$$ = new Rx.Subject<CheckFailed>()
const checkFailed$: Rx.Observable<CheckFailed> = checkFailed$$.asObservable()

/**
 * Builds a client by `build$`, again on every `rebuildClient` trigger (same inputs).
 * `build$` checks the node first. If that fails, a rebuild keeps the last client, a first build fails.
 */
const buildOnRebuild = ({
  build$,
  failure,
  readOnly
}: {
  build$: () => ClientState$
  failure: (error: unknown) => ClientState
  readOnly: boolean
}): ClientState$ => {
  let last: O.Option<Client> = O.none
  return rebuildClient$.pipe(
    RxOp.switchMap(() =>
      build$().pipe(
        RxOp.tap((state) => {
          last = RD.isSuccess(state) ? O.some(state.value) : O.none
        }),
        RxOp.catchError((error) => {
          checkFailed$$.next({ readOnly, kept: last })
          return O.isSome(last) ? Rx.EMPTY : Rx.of(failure(error))
        })
      )
    )
  )
}

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

const hdSettings$ = keystoreChainHDSettings$(MAYAChain)

/**
 * Stream to create an observable `MayachainClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `MayachainClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `MayachainClient` will never be created as long as no phrase is available
 */
const clientState$: ClientState$ = FP.pipe(
  Rx.combineLatest([keystoreService.keystoreState$, clientNetwork$, clientUrl$, hdSettings$]),
  RxOp.switchMap(([keystore, network, clientUrl, hdSettings]): ClientState$ =>
    FP.pipe(
      getPhrase(keystore),
      O.fold(
        // No phrase (locked wallet): `initial`, no node check
        (): ClientState$ => Rx.of(RD.initial),
        (phrase) =>
          buildOnRebuild({
            readOnly: false,
            build$: () =>
              // request chain id from node whenever network or keystore state have been changed
              Rx.from(getChainIdShared(clientUrl[network].node)).pipe(
                RxOp.map((): ClientState => {
                  try {
                    const { rootDerivationPaths } = getKeystoreDerivation(MAYAChain, hdSettings)
                    const getDefaultClientUrls = (): Record<Network, string[]> => ({
                      [Network.Testnet]: [clientUrl[Network.Testnet].rpc],
                      [Network.Stagenet]: [clientUrl[Network.Stagenet].rpc],
                      [Network.Mainnet]: [clientUrl[Network.Mainnet].rpc]
                    })
                    const client = new Client({
                      clientUrls: getDefaultClientUrls(),
                      rootDerivationPaths,
                      network,
                      phrase
                    })
                    return RD.success(client)
                  } catch (error) {
                    return RD.failure<Error>(isError(error) ? error : new Error('Failed to create MAYA client'))
                  }
                })
              ),
            failure: (error) => RD.failure<Error>(isError(error) ? error : new Error('Failed to get MAYA chain id'))
          })
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
  RxOp.switchMap(([network, clientUrl]): ClientState$ =>
    buildOnRebuild({
      readOnly: true,
      build$: () =>
        // request chain id from node whenever network changes
        Rx.from(getChainIdShared(clientUrl[network].node)).pipe(
          RxOp.map((): ClientState => {
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
          })
        ),
      failure: (error) => RD.failure<Error>(isError(error) ? error : new Error('Unknown error'))
    })
  ),
  RxOp.startWith(RD.initial),
  RxOp.shareReplay(1)
)

const addressHDSettings$ = hdSettings$.pipe(
  RxOp.map((s) => {
    const { walletIndex } = getKeystoreDerivation(MAYAChain, s ?? DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS)
    return { hdMode: s.hdMode, account: s.account, index: walletIndex }
  })
)

/**
 * `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, MAYAChain, addressHDSettings$)

/**
 * `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, MAYAChain, addressHDSettings$)

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
  rebuildClient,
  checkFailed$,
  setMayanodeRpcUrl,
  setMayanodeApiUrl,
  address$,
  addressUI$,
  explorerUrl$
}
