import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { baseAmount, BaseAmount } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'

import { useMidgardContext } from '../contexts/MidgardContext'
import { THORCHAIN_DECIMAL } from '../helpers/assetHelper'
import { liveData } from '../helpers/rx/liveData'
import { useObservableLayoutState } from './useObservableLayoutState'

type Limit = {
  reached: boolean
  totalActiveBondAmount: BaseAmount
  totalPooledRuneAmount: BaseAmount
}

export type LimitRD = RD.RemoteData<Error, Limit>

export const getLimit = (totalPooledRune: string, totalActiveBond: string, decimal = THORCHAIN_DECIMAL): Limit => {
  const totalActiveBondAmount = baseAmount(totalActiveBond, decimal)
  const totalPooledRuneAmount = baseAmount(totalPooledRune, decimal)
  const reached = totalPooledRuneAmount.gte(totalActiveBondAmount)

  return {
    reached,
    totalActiveBondAmount,
    totalPooledRuneAmount
  }
}

export const useProtocolLimit = (enabled = true): { data: LimitRD; reload: FP.Lazy<void> } => {
  const {
    service: { networkInfo$, reloadNetworkInfo }
  } = useMidgardContext()

  const source$ = useMemo((): Rx.Observable<LimitRD> => {
    if (!enabled) return Rx.EMPTY
    return FP.pipe(
      networkInfo$,
      liveData.map(({ totalPooledRune, bondMetrics: { totalActiveBond } }) =>
        getLimit(totalPooledRune, totalActiveBond)
      )
    )
  }, [enabled, networkInfo$])

  const data = useObservableLayoutState(source$, RD.initial)

  return { data, reload: reloadNetworkInfo }
}
