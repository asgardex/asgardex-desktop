import * as RD from '@devexperts/remote-data-ts'
import { ETHChain, Client } from '@xchainjs/xchain-ethereum'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { createEthParams } from '../../../shared/ethereum/const'
import { isError } from '../../../shared/utils/guard'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { WalletAddress$, ExplorerUrl$ } from '../clients/types'
import { Client$, ClientState, ClientState$ } from '../evm/types'
import { ethRpc$ } from '../storage/common'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'

/**
 * Stream to create an observable `EthereumClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `EthereumClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `EthereumClient` will never be created as long as no phrase is available
 */
const clientState$: ClientState$ = FP.pipe(
  Rx.combineLatest([keystoreService.keystoreState$, clientNetwork$, ethRpc$]),
  RxOp.switchMap(
    ([keystore, network, rpcUrls]): ClientState$ =>
      Rx.of(
        FP.pipe(
          getPhrase(keystore),
          O.map<string, ClientState>((phrase) => {
            try {
              const rpcUrl = rpcUrls[network]
              const params = createEthParams(rpcUrl, network)
              const client = new Client({
                ...params,
                network: network,
                phrase: phrase
              })
              return RD.success(client)
            } catch (error) {
              return RD.failure<Error>(isError(error) ? error : new Error('Failed to create ETH client'))
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
 * Read-only ETH client for balance queries without requiring keystore
 * This client can be used for standalone ledger mode to query balances
 */
const readOnlyClientState$: ClientState$ = FP.pipe(
  Rx.combineLatest([clientNetwork$, ethRpc$]),
  RxOp.map(([network, rpcUrls]): ClientState => {
    try {
      const rpcUrl = rpcUrls[network]
      const params = createEthParams(rpcUrl, network)
      // Create client without phrase - only for balance queries
      const client = new Client({
        ...params,
        network: network
        // No phrase - this limits functionality to read-only operations
      })
      return RD.success(client)
    } catch (error) {
      return RD.failure<Error>(isError(error) ? error : new Error('Failed to create read-only ETH client'))
    }
  }),
  RxOp.startWith<ClientState>(RD.pending),
  RxOp.shareReplay(1)
)

const readOnlyClient$: Client$ = readOnlyClientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * Current `Address` depending on selected network
 */
const address$: WalletAddress$ = C.address$(client$, ETHChain)

/**
 * Current `Address` depending on selected network
 */
const addressUI$: WalletAddress$ = C.addressUI$(client$, ETHChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, readOnlyClient$, address$, addressUI$, explorerUrl$ }
