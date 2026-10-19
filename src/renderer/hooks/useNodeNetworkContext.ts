import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import type { NodeNetworkContext } from '../components/Bonds/provider/nodeNetwork'
import { useThorchainContext } from '../contexts/ThorchainContext'
import { useChurnConstants } from './useChurnConstants'
import { useThorchainHeight } from './useThorchainHeight'
import { useThorchainVersion } from './useThorchainVersion'

export const useNodeNetworkContext = (): O.Option<NodeNetworkContext> => {
  const { getNodeInfos$ } = useThorchainContext()
  const nodesRD = useObservableState(getNodeInfos$, RD.initial)
  const versionRD = useThorchainVersion()
  const oHeight = useThorchainHeight()
  const constants = useChurnConstants()

  return useMemo(
    () =>
      FP.pipe(
        O.Do,
        O.apS('nodes', RD.toOption(nodesRD)),
        O.apS('currentHeight', oHeight),
        O.map(({ nodes, currentHeight }): NodeNetworkContext => ({
          nodes,
          currentHeight,
          constants,
          version: FP.pipe(versionRD, RD.toOption, O.toUndefined)
        }))
      ),
    [constants, nodesRD, oHeight, versionRD]
  )
}
