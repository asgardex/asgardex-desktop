import * as RD from '@devexperts/remote-data-ts'
import { AVAXChain } from '@xchainjs/xchain-avax'
import * as ETH from '@xchainjs/xchain-evm'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { defaultAvaxParams, FEE_BOUNDS } from '../../../shared/avax/const'
import { isError } from '../../../shared/utils/guard'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { WalletAddress$, ExplorerUrl$ } from '../clients/types'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { Client$, ClientState, ClientState$ } from './types'

/**
 * Stream to create an observable `EthereumClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `EthereumClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `EthereumClient` will never be created as long as no phrase is available
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
              const client = new ETH.Client({
                ...defaultAvaxParams,
                network: network,
                phrase: phrase,
                feeBounds: FEE_BOUNDS[network]
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
 * Current `Address` depending on selected network
 */
const address$: WalletAddress$ = C.address$(client$, AVAXChain)

/**
 * Current `Address` depending on selected network
 */
const addressUI$: WalletAddress$ = C.addressUI$(client$, AVAXChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: ExplorerUrl$ = C.explorerUrl$(client$)

// /**
//  * Map to store decimal in memory
//  *
//  * to avoid unessary request for same data
//  * */
// // const decimalMap: Map<string, number> = new Map()
// // /**
//  * Helper to get decimals for ERC20
//  */
// const getERC20Decimal = async (asset: Asset, network: Network): Promise<number> => {
//   const assetString = assetToString(asset)
//   return FP.pipe(
//     decimalMap.get(assetString),
//     O.fromNullable,
//     O.fold(
//       async () => {
//         // https://docs.ethers.io/v5/api/providers/api-providers/#EtherscanProvider
//         const ethNetwork = network === 'testnet' ? 'ropsten' : 'homestead'
//         const provider = new EtherscanProvider(ethNetwork, getEtherscanApiKey())
//         try {
//           const decimal = await ETH.(asset, provider)
//           // store result in memory
//           decimalMap.set(assetString, decimal)
//           return Promise.resolve(decimal)
//         } catch (e) {
//           return Promise.reject(e)
//         }
//       },
//       async (decimal) => Promise.resolve(decimal)
//     )
//   )
// }

export { client$, clientState$, address$, addressUI$, explorerUrl$ }
