import * as RD from '@devexperts/remote-data-ts'
import { Client as ADAClient, ADAChain, defaultAdaParams, BlockfrostApiKey } from '@xchainjs/xchain-cardano'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { adaApiKey } from '../../../shared/api/blockfrost'
import { isError } from '../../../shared/utils/guard'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { Client$, ClientState, ClientState$ } from './types'

const blockfrostApiKeys: BlockfrostApiKey[] = [
  {
    mainnet: adaApiKey,
    stagenet: adaApiKey,
    testnet: ''
  }
]

/**
 * Stream to create an observable `CardanoClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `CardanoClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `CardanoClient` will never be created as long as no phrase is available
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
              const adaInitParams = {
                ...defaultAdaParams,
                network: network,
                phrase: phrase,
                apiKeys: {
                  blockfrostApiKeys
                }
              }
              const client = new ADAClient(adaInitParams)
              return RD.success(client)
            } catch (error) {
              console.error('Failed to create ADA client', error)
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

const client$: Client$ = clientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * `Address`
 */
const address$: C.WalletAddress$ = C.address$(client$, ADAChain)

/**
 * `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, ADAChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, address$, addressUI$, explorerUrl$ }
