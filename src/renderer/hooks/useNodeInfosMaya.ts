import { useEffect, useState, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { array as A, function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { NodeInfo as NodeInfoMaya } from '../services/mayachain/types'
import { WalletAddressInfo } from '../views/bonds/types'

export type ExtendedNodeInfoMaya = NodeInfoMaya & {
  isUserStoredNodeAddress: boolean
  isUserBondProvider: boolean
}

type UseMayaNodeInfosParams = {
  addressesFetched: boolean
  mayaWalletAddresses: WalletAddressInfo[]
  userNodes$: Rx.Observable<string[]>
  getNodeInfosMaya$: Rx.Observable<RD.RemoteData<Error, NodeInfoMaya[]>>
}

export const useMayaNodeInfos = ({
  addressesFetched,
  mayaWalletAddresses,
  userNodes$,
  getNodeInfosMaya$
}: UseMayaNodeInfosParams): RD.RemoteData<Error, ExtendedNodeInfoMaya[]> => {
  const [nodeInfos, setNodeInfos] = useState<RD.RemoteData<Error, ExtendedNodeInfoMaya[]>>(RD.initial)

  const walletAddressSet = useMemo(
    () => new Set(mayaWalletAddresses.map((addr) => addr.address.toLowerCase())),
    [mayaWalletAddresses]
  )

  const nodeInfos$ = useMemo(() => {
    if (!addressesFetched) return Rx.of(RD.initial)

    return FP.pipe(
      Rx.combineLatest([userNodes$, getNodeInfosMaya$.pipe(RxOp.startWith(RD.initial))]),
      RxOp.switchMap(([userNodes, nodeInfosMaya]) => {
        const normalizedUserNodes = userNodes.map((node) => node.toLowerCase())

        return Rx.of(
          FP.pipe(
            nodeInfosMaya, // Work directly with RemoteData<Error, NodeInfoMaya[]>
            RD.map((mayaData: NodeInfoMaya[]) =>
              FP.pipe(
                mayaData,
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
  }, [addressesFetched, userNodes$, getNodeInfosMaya$, walletAddressSet])

  useEffect(() => {
    const subscription = nodeInfos$.subscribe(setNodeInfos)
    return () => subscription.unsubscribe()
  }, [nodeInfos$])

  return nodeInfos
}
