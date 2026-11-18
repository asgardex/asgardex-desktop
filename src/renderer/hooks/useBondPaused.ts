import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { useObservableState } from 'observable-hooks'

import { useThorchainContext } from '../contexts/ThorchainContext'
import { createMimirLookup } from '../helpers/mimirLookup'

export type BondPauseStatus = 'active' | 'paused' | 'unknown'

export const useBondPauseStatus = (): BondPauseStatus => {
  const { mimir$ } = useThorchainContext()
  const [mimirRD] = useObservableState(() => mimir$, RD.initial)

  return useMemo(() => {
    if (!RD.isSuccess(mimirRD)) return 'unknown'
    const values = createMimirLookup(mimirRD.value, 'THORNode')('PAUSEBOND').map(Number)
    if (values.some((value) => !Number.isFinite(value))) return 'unknown'
    return values.some((value) => value > 0) ? 'paused' : 'active'
  }, [mimirRD])
}

export const bondPauseMessageId = (status: BondPauseStatus) =>
  status === 'paused' ? 'bonds.paused.description' : 'bonds.paused.unknown'
