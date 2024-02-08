import * as RD from '@devexperts/remote-data-ts'
import { Client as KujiClient, KUJIChain, defaultKujiParams } from '@xchainjs/xchain-kujira'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isError } from '../../../shared/utils/guard'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { Client$, ClientState, ClientState$ } from './types'

/**
 * Stream to create an observable `KujichainClient` depending on existing phrase in keystore
 *
 * Whenever a phrase has been added to keystore, a new `KujichainClient` will be created.
 * By the other hand: Whenever a phrase has been removed, `ClientState` is set to `initial`
 * A `KujichainClient` will never be created as long as no phrase is available
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
              const kujiInitParams = {
                ...defaultKujiParams,
                network: network,
                phrase: phrase
              }
              const client = new KujiClient(kujiInitParams)
              return RD.success(client)
            } catch (error) {
              console.error('Failed to create KUJI client', error)
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
const address$: C.WalletAddress$ = C.address$(client$, KUJIChain)

/**
 * `Address`
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, KUJIChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(client$)

export { client$, clientState$, address$, addressUI$, explorerUrl$ }
