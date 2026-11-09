import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { BaseAmount } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { runebondRoomLeft } from '../components/Bonds/provider/helpers'
import { useThorchainContext } from '../contexts/ThorchainContext'
import { ListedNode } from '../services/runebond'
import { NodeInfo } from '../services/thorchain/types'
import { useChurnConstants } from './useChurnConstants'
import { useListedNodes } from './useRunebondListing'

export type RunebondDirectoryNode = {
  listing: ListedNode
  node: NodeInfo
  roomLeft: BaseAmount
  providersCount: number
  maxProviders: number
}

export type RunebondDirectoryError = { source: 'runebond' | 'thornode'; error: Error }

export const useRunebondDirectory = (): RD.RemoteData<RunebondDirectoryError, RunebondDirectoryNode[]> => {
  const { getNodeInfos$ } = useThorchainContext()
  const nodeInfosRD = useObservableState(getNodeInfos$, RD.initial)
  const listedNodesRD = useListedNodes()
  const { maxBondProviders } = useChurnConstants()

  return useMemo(
    () =>
      FP.pipe(
        RD.combine(
          FP.pipe(
            listedNodesRD,
            RD.mapLeft((error): RunebondDirectoryError => ({ source: 'runebond', error }))
          ),
          FP.pipe(
            nodeInfosRD,
            RD.mapLeft((error): RunebondDirectoryError => ({ source: 'thornode', error }))
          )
        ),
        RD.map(([listed, nodes]) => {
          const byAddress = new Map(nodes.map((node) => [node.address.toLowerCase(), node]))
          return listed.flatMap((listing): RunebondDirectoryNode[] => {
            const node = byAddress.get(listing.nodeAddress.toLowerCase())
            if (!node || node.nodeOperatorAddress.toLowerCase() !== listing.operatorAddress.toLowerCase()) return []
            return [
              {
                listing,
                node,
                roomLeft: runebondRoomLeft(listing.targetTotalBond, node.bond),
                providersCount: node.bondProviders.providers.length,
                maxProviders: maxBondProviders
              }
            ]
          })
        })
      ),
    [listedNodesRD, nodeInfosRD, maxBondProviders]
  )
}
