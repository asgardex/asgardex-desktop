import { useCallback, useMemo } from 'react'

import { option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { GasMultiplier } from '../../shared/api/types'
import { DEFAULT_EVM_GAS_MULTIPLIER } from '../../shared/const'
import { evmGasMultiplier$, modifyStorage } from '../services/storage/common'

// Available gas multiplier options
export const GAS_MULTIPLIER_OPTIONS: number[] = [1, 1.5, 2, 3, 5, 10]

type EvmGasMultiplierHook = {
  multiplier: number
  setMultiplier: (multiplier: GasMultiplier) => void
}

export const useEvmGasMultiplier = (): EvmGasMultiplierHook => {
  const multiplier = useObservableState(evmGasMultiplier$, DEFAULT_EVM_GAS_MULTIPLIER)

  const setMultiplier = useCallback((newMultiplier: GasMultiplier) => {
    modifyStorage(
      O.some({
        evmGasMultiplier: newMultiplier
      })
    )
  }, [])

  return useMemo(
    () => ({
      // Ensure we always return a valid multiplier
      multiplier: GAS_MULTIPLIER_OPTIONS.includes(multiplier) ? multiplier : DEFAULT_EVM_GAS_MULTIPLIER,
      setMultiplier
    }),
    [multiplier, setMultiplier]
  )
}
