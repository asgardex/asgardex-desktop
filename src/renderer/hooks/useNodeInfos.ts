import { useEffect, useState, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { array as A, function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { NodeInfo as NodeInfoThor } from '../services/thorchain/types'
import { WalletAddressInfo } from '../views/bonds/types'

export type ExtendedNodeInfoThor = NodeInfoThor & {
  isUserStoredNodeAddress: boolean
  isUserBondProvider: boolean
}

type UseThorNodeInfosParams = {
  addressesFetched: boolean
  thorWalletAddresses: WalletAddressInfo[]
  userNodes$: Rx.Observable<string[]>
  getNodeInfosThor$: Rx.Observable<RD.RemoteData<Error, NodeInfoThor[]>>
}

export const useThorNodeInfos = ({
  addressesFetched,
  thorWalletAddresses,
  userNodes$,
  getNodeInfosThor$
}: UseThorNodeInfosParams): RD.RemoteData<Error, ExtendedNodeInfoThor[]> => {
  const [nodeInfos, setNodeInfos] = useState<RD.RemoteData<Error, ExtendedNodeInfoThor[]>>(RD.initial)

  const walletAddressSet = useMemo(
    () => new Set(thorWalletAddresses.map((addr) => addr.address.toLowerCase())),
    [thorWalletAddresses]
  )

  const nodeInfos$ = useMemo(() => {
    if (!addressesFetched) return Rx.of(RD.initial)

    return FP.pipe(
      Rx.combineLatest([userNodes$, getNodeInfosThor$.pipe(RxOp.startWith(RD.initial))]),
      RxOp.switchMap(([userNodes, nodeInfosThor]) => {
        const normalizedUserNodes = userNodes.map((node) => node.toLowerCase())

        return Rx.of(
          FP.pipe(
            nodeInfosThor,
            RD.map((thorData: NodeInfoThor[]) =>
              FP.pipe(
                thorData,
                A.map((nodeInfo) => {
                  const isUserStoredNodeAddress = normalizedUserNodes.includes(nodeInfo.address.toLowerCase())
                  const isUserBondProvider = nodeInfo.bondProviders.providers.some((provider) =>
                    walletAddressSet.has(provider.bondAddress.toLowerCase())
                  )

                  return {
                    ...nodeInfo,
                    isUserStoredNodeAddress,
                    isUserBondProvider
                  }
                }),
                A.filter((nodeInfo) => nodeInfo.isUserStoredNodeAddress || nodeInfo.isUserBondProvider)
              )
            )
          )
        )
      }),
      RxOp.startWith(RD.initial),
      RxOp.shareReplay(1)
    )
  }, [addressesFetched, userNodes$, getNodeInfosThor$, walletAddressSet])

  useEffect(() => {
    const subscription = nodeInfos$.subscribe(setNodeInfos)
    return () => subscription.unsubscribe()
  }, [nodeInfos$])

  return nodeInfos
}
