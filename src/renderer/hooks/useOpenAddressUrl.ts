import { useCallback } from 'react'

import { Chain } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { OpenAddressUrl } from '../services/clients'
import { getAddress$, getExplorerAddressUrl$ } from '../services/xchainjs-wallet/wallet' // Adjust path as needed

export const useOpenAddressUrl = (oChain: O.Option<Chain>): OpenAddressUrl => {
  const openAddressUrl: OpenAddressUrl = useCallback(
    (searchParams?: { param: string; value: string }[]) =>
      FP.pipe(
        oChain,
        O.chain((chain) =>
          FP.pipe(
            getAddress$(chain), // Fetch the wallet address for the chain
            RxOp.switchMap(
              O.fold(
                () => Rx.of(O.none), // No address available
                (walletAddress) => getExplorerAddressUrl$(chain, walletAddress.address) // Use the fetched address
              )
            ),
            RxOp.first(), // Take the first emitted value
            RxOp.map(
              O.map(async (baseUrl) => {
                const url = new URL(baseUrl)
                FP.pipe(
                  O.fromNullable(searchParams),
                  O.map(A.map(({ param, value }) => url.searchParams.append(param, value)))
                )
                await window.apiUrl.openExternal(url.toString())
                return true
              })
            ),
            RxOp.switchMap(O.getOrElse(() => Rx.of(Promise.resolve(false))))
          )
        ),
        O.getOrElse(() => Promise.resolve(false))
      ),
    [oChain]
  )

  return openAddressUrl
}
