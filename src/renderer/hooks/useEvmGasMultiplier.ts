import { useCallback, useMemo } from 'react'

import { option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { GasMultiplier } from '../../shared/api/types'
import { DEFAULT_EVM_GAS_MULTIPLIER } from '../../shared/const'
import { evmGasMultiplier$, modifyStorage } from '../services/storage/common'

// Available gas multiplier options - must match GasMultiplier type
export const GAS_MULTIPLIER_OPTIONS: GasMultiplier[] = [1, 1.5, 2, 3, 5, 10]

type EvmGasMultiplierHook = {
  multiplier: GasMultiplier
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
      multiplier: (GAS_MULTIPLIER_OPTIONS as number[]).includes(multiplier)
        ? (multiplier as GasMultiplier)
        : DEFAULT_EVM_GAS_MULTIPLIER,
      setMultiplier
    }),
    [multiplier, setMultiplier]
  )
}
