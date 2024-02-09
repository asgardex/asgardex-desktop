import { useCallback, useEffect } from 'react'

import { XChainClient } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useChainContext } from '../contexts/ChainContext'
import { eqOChain } from '../helpers/fp/eq'
import { OpenAddressUrl } from '../services/clients'

export const useOpenAddressUrl = (oChain: O.Option<Chain>): OpenAddressUrl => {
  const { clientByChain$ } = useChainContext()

  const [oClient, chainUpdated] = useObservableState<O.Option<XChainClient>, O.Option<Chain>>(
    (oChain$) =>
      FP.pipe(
        oChain$,
        RxOp.distinctUntilChanged(eqOChain.equals), // Ensure we only react to actual changes
        RxOp.switchMap(FP.flow(O.fold(() => Rx.EMPTY, clientByChain$))) // Retrieve client based on chain
      ),
    O.none
  )

  // Trigger chain update
  useEffect(() => {
    chainUpdated(oChain)
  }, [oChain, chainUpdated])

  // Define the openAddressUrl function
  const openAddressUrl: OpenAddressUrl = useCallback(
    (address, searchParams) =>
      FP.pipe(
        oClient,
        O.map(async (client) => {
          const url = new URL(client.getExplorerAddressUrl(address))
          // update search params
          FP.pipe(
            searchParams,
            O.fromNullable,
            O.map(A.map(({ param, value }) => url.searchParams.append(param, value)))
          )
          await window.apiUrl.openExternal(url.toString())
          return true
        }),
        O.getOrElse<Promise<boolean>>(() => Promise.resolve(false))
      ),
    [oClient]
  )

  return openAddressUrl
}
