import { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { array as A, function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { NodeInfo } from '../services/thorchain/types'

/** last value replayed synchronously by a shared stream, `initial` otherwise */
const currentValue = <T>(observable: Rx.Observable<T>, initial: T): T => {
  let value = initial
  const subscription = observable.subscribe((next) => {
    value = next
  })
  subscription.unsubscribe()
  return value
}

export type OperatorNodeInfo = NodeInfo & {
  isOperator: boolean
  isMonitored: boolean
}

type UseOperatorNodesParams = {
  walletAddresses: string[]
  userNodes$: Rx.Observable<string[]>
  getNodeInfos$: Rx.Observable<RD.RemoteData<Error, NodeInfo[]>>
}

/**
 * Nodes shown on the node operator tab: the ones the connected wallet operates
 * plus the ones the user added to the monitoring list.
 */
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

  // start from the replayed value so a remount renders the data right away
  const [nodes, setNodes] = useState<RD.RemoteData<Error, OperatorNodeInfo[]>>(() => currentValue(nodes$, RD.initial))

  useEffect(() => {
    const subscription = nodes$.subscribe(setNodes)
    return () => subscription.unsubscribe()
  }, [nodes$])

  return nodes
}
