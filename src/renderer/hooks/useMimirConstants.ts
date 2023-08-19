import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { useObservableState } from 'observable-hooks'

import { useThorchainContext } from '../contexts/ThorchainContext'

export const useMimirConstants = (keys: string[]): { [key: string]: number } => {
  const { mimir$ } = useThorchainContext() // Assume mimir$ is of type MimirLD

  // Subscribe to mimir$ and get its current value as a RemoteData object
  const [mimirRD] = useObservableState(() => mimir$, RD.initial)

  return useMemo(() => {
    if (RD.isSuccess(mimirRD)) {
      const values: { [key: string]: number } = {}
      keys.forEach((key) => {
        values[key] = mimirRD.value[key] // Access the value for each key
      })
      return values
    }

    return {}
  }, [mimirRD, keys])
}
