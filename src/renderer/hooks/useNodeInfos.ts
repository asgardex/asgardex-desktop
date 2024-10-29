import { useEffect, useState, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { NodeInfo, NodeInfo as NodeInfoMaya } from '../services/mayachain/types'
import { WalletAddressInfo } from '../views/wallet/BondsView'

type UseNodeInfosParams = {
  addressesFetched: boolean
  walletAddresses: Record<'THOR' | 'MAYA', WalletAddressInfo[]>
  userNodes$: Rx.Observable<string[]>
  getNodeInfos$: Rx.Observable<RD.RemoteData<Error, NodeInfo[]>>
  getNodeInfosMaya$: Rx.Observable<RD.RemoteData<Error, NodeInfoMaya[]>>
}

export const useNodeInfos = ({
  addressesFetched,
  walletAddresses,
  userNodes$,
  getNodeInfos$,
  getNodeInfosMaya$
}: UseNodeInfosParams): RD.RemoteData<Error, NodeInfo[]> => {
  const [nodeInfos, setNodeInfos] = useState<RD.RemoteData<Error, NodeInfo[]>>(RD.initial)

  // Create a Set of all wallet addresses for lookup
  const walletAddressSet = useMemo(
    () =>
      new Set([
        ...walletAddresses.THOR.map((addr) => addr.address.toLowerCase()),
        ...walletAddresses.MAYA.map((addr) => addr.address.toLowerCase())
      ]),
    [walletAddresses]
  )

  // Observable to combine node information
  const nodeInfos$ = useMemo(() => {
    if (!addressesFetched) return Rx.of(RD.initial)

    return FP.pipe(
      Rx.combineLatest([
        userNodes$,
        Rx.combineLatest([
          getNodeInfos$.pipe(RxOp.startWith(RD.initial)),
          getNodeInfosMaya$.pipe(RxOp.startWith(RD.initial))
        ])
      ]),
      RxOp.switchMap(([userNodes, [nodeInfosThor, nodeInfosMaya]]) => {
        const normalizedUserNodes = userNodes.map((node) => node.toLowerCase())

        return Rx.of(
          FP.pipe(
            RD.combine(nodeInfosThor, nodeInfosMaya),
            RD.map(([thorData, mayaData]) =>
              FP.pipe(
                [...thorData, ...mayaData],
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
  }, [addressesFetched, userNodes$, getNodeInfos$, getNodeInfosMaya$, walletAddressSet])

  // Subscribe to the observable and update state
  useEffect(() => {
    const subscription = nodeInfos$.subscribe(setNodeInfos)
    return () => subscription.unsubscribe()
  }, [nodeInfos$])

  return nodeInfos
}
