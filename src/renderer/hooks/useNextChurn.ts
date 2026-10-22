import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { useMidgardContext } from '../contexts/MidgardContext'
import { useMimirConstants } from './useMimirConstants'
import { useThorchainHeight } from './useThorchainHeight'

const THOR_BLOCK_TIME_MS = 6000
const HALT_KEYS = ['HALTCHURNING']

export type NextChurn = { halted: false; blocksLeft: number; msLeft: number } | { halted: true }

export const useNextChurn = (): O.Option<NextChurn> => {
  const {
    service: { networkInfo$ }
  } = useMidgardContext()
  const networkInfoRD = useObservableState(networkInfo$, RD.initial)
  const oHeight = useThorchainHeight()
  const { HALTCHURNING: haltChurning } = useMimirConstants(HALT_KEYS)

  return useMemo(
    () =>
      FP.pipe(
        O.Do,
        O.apS('networkInfo', RD.toOption(networkInfoRD)),
        O.apS('height', oHeight),
        O.chain(({ networkInfo, height }): O.Option<NextChurn> => {
          const halt = Number(haltChurning)
          if (Number.isFinite(halt) && halt > 0 && halt <= height) return O.some({ halted: true })
          const nextChurnHeight = Number(networkInfo.nextChurnHeight)
          if (!Number.isFinite(nextChurnHeight)) return O.none
          const blocksLeft = Math.max(nextChurnHeight - height, 0)
          return O.some({ halted: false, blocksLeft, msLeft: blocksLeft * THOR_BLOCK_TIME_MS })
        })
      ),
    [haltChurning, networkInfoRD, oHeight]
  )
}
