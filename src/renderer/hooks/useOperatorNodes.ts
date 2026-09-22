import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { array as A, function as FP } from 'fp-ts'
import { useObservableEagerState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { NodeInfo } from '../services/thorchain/types'

export type OperatorNodeInfo = NodeInfo & {
  isOperator: boolean
  isMonitored: boolean
}

type UseOperatorNodesParams = {
  walletAddresses: string[]
  userNodes$: Rx.Observable<string[]>
  getNodeInfos$: Rx.Observable<RD.RemoteData<Error, NodeInfo[]>>
}

export const useOperatorNodes = ({
  walletAddresses,
  userNodes$,
  getNodeInfos$
}: UseOperatorNodesParams): RD.RemoteData<Error, OperatorNodeInfo[]> => {
  const walletAddressSet = useMemo(
    () => new Set(walletAddresses.map((address) => address.toLowerCase())),
    [walletAddresses]
  )

  const nodes$ = useMemo(
    () =>
      FP.pipe(
        Rx.combineLatest([userNodes$, getNodeInfos$.pipe(RxOp.startWith(RD.initial))]),
        RxOp.map(([userNodes, nodeInfosRD]) => {
          const monitored = new Set(userNodes.map((node) => node.toLowerCase()))
          return FP.pipe(
            nodeInfosRD,
            RD.map((nodeInfos: NodeInfo[]) =>
              FP.pipe(
                nodeInfos,
                A.map((nodeInfo) => ({
                  ...nodeInfo,
                  isOperator: walletAddressSet.has(nodeInfo.nodeOperatorAddress.toLowerCase()),
                  isMonitored: monitored.has(nodeInfo.address.toLowerCase())
                })),
                A.filter(({ isOperator, isMonitored }) => isOperator || isMonitored)
              )
            )
          )
        }),
        RxOp.startWith(RD.initial),
        RxOp.shareReplay(1)
      ),
    [getNodeInfos$, userNodes$, walletAddressSet]
  )

  return useObservableEagerState(nodes$)
}
