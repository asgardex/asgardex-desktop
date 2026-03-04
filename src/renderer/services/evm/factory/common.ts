import * as RD from '@devexperts/remote-data-ts'
import type { Network } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ApiUrls } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { clientNetwork$ } from '../../app/service'
import * as C from '../../clients'
import { WalletAddress$, ExplorerUrl$ } from '../../clients/types'
import { keystoreService } from '../../wallet/keystore'
import { getPhrase } from '../../wallet/util'
import { Client$, ClientState, ClientState$ } from '../types'

export type EvmCommonConfig = {
  chain: Chain
  chainName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ClientClass: new (params: any) => any
  createClientParams: (rpcUrl: string, network: Network) => Record<string, unknown>
  rpc$: Rx.Observable<ApiUrls>
}

export const createEvmCommonService = (config: EvmCommonConfig) => {
  const { chain, chainName, ClientClass, createClientParams, rpc$ } = config

  const clientState$: ClientState$ = FP.pipe(
    Rx.combineLatest([keystoreService.keystoreState$, clientNetwork$, rpc$]),
    RxOp.switchMap(
      ([keystore, network, rpcUrls]): ClientState$ =>
        Rx.of(
          FP.pipe(
            getPhrase(keystore),
            O.map<string, ClientState>((phrase) => {
              try {
                const rpcUrl = rpcUrls[network]
                const params = createClientParams(rpcUrl, network)
                const client = new ClientClass({
                  ...params,
                  network: network,
                  phrase: phrase
                })
                return RD.success(client)
              } catch (error) {
                return RD.failure<Error>(isError(error) ? error : new Error(`Failed to create ${chainName} client`))
              }
            }),
            O.getOrElse<ClientState>(() => RD.initial)
          )
        ).pipe(RxOp.startWith(RD.pending))
    ),
    RxOp.startWith<ClientState>(RD.initial),
    RxOp.shareReplay(1)
  )

  const client$: Client$ = clientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

  const readOnlyClientState$: ClientState$ = FP.pipe(
    Rx.combineLatest([clientNetwork$, rpc$]),
    RxOp.map(([network, rpcUrls]): ClientState => {
      try {
        const rpcUrl = rpcUrls[network]
        const params = createClientParams(rpcUrl, network)
        const client = new ClientClass({
          ...params,
          network: network
        })
        return RD.success(client)
      } catch (error) {
        return RD.failure<Error>(isError(error) ? error : new Error(`Failed to create read-only ${chainName} client`))
      }
    }),
    RxOp.startWith<ClientState>(RD.pending),
    RxOp.shareReplay(1)
  )

  const readOnlyClient$: Client$ = readOnlyClientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

  const address$: WalletAddress$ = C.address$(client$, chain)
  const addressUI$: WalletAddress$ = C.addressUI$(client$, chain)
  const explorerUrl$: ExplorerUrl$ = C.explorerUrl$(client$)

  return { client$, clientState$, readOnlyClient$, address$, addressUI$, explorerUrl$ }
}
