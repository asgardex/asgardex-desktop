import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { useMidgardContext } from '../contexts/MidgardContext'
import { useThorchainContext } from '../contexts/ThorchainContext'

/** Average THORChain block time in ms */
const THOR_BLOCK_TIME_MS = 6000

export type NextChurn = {
  blocksLeft: number
  msLeft: number
}

/**
 * Estimated time until the next churn, from Midgard's `nextChurnHeight`
 * and THORNode's last block height (~6s per block).
 */
export const useNextChurn = (): O.Option<NextChurn> => {
  const {
    service: { networkInfo$ }
  } = useMidgardContext()
  const { thorchainLastblockState$ } = useThorchainContext()

  const networkInfoRD = useObservableState(networkInfo$, RD.initial)
  const lastblockRD = useObservableState(thorchainLastblockState$, RD.initial)

  return useMemo(
    () =>
      FP.pipe(
        RD.combine(networkInfoRD, lastblockRD),
        RD.toOption,
        O.chain(([networkInfo, lastblocks]) => {
          const nextChurnHeight = Number(networkInfo.nextChurnHeight)
          const thorchainBlock = lastblocks.find((block) => block.thorchain)
          if (!thorchainBlock || !Number.isFinite(nextChurnHeight)) return O.none
          const blocksLeft = Math.max(nextChurnHeight - thorchainBlock.thorchain, 0)
          return O.some({ blocksLeft, msLeft: blocksLeft * THOR_BLOCK_TIME_MS })
        })
      ),
    [networkInfoRD, lastblockRD]
  )
}
