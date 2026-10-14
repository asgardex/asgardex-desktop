import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { BaseAmount, baseAmount } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useMidgardContext } from '../contexts/MidgardContext'
import { THORCHAIN_DECIMAL } from '../helpers/assetHelper'
import { useObservableLayoutState } from './useObservableLayoutState'

export type Color = 'green' | 'yellow' | 'red' | 'grey'

export type IncentivePendulum = {
  totalActiveBondAmount: BaseAmount
  totalPooledRuneAmount: BaseAmount
  incentivePendulum: number // percent
  incentivePendulumLight: Color
}

export type IncentivePendulumRD = RD.RemoteData<Error, IncentivePendulum>

export const getIncentivePendulum = (totalPooledRune: string, totalActiveBond: string): IncentivePendulum => {
  const totalActiveBondAmount = baseAmount(totalActiveBond, THORCHAIN_DECIMAL)
  const totalPooledRuneAmount = baseAmount(totalPooledRune, THORCHAIN_DECIMAL)
  const incentivePendulumAmount = totalActiveBondAmount.gt(0)
    ? totalPooledRuneAmount.times(200).div(totalActiveBondAmount)
    : totalActiveBondAmount // zero
  const incentivePendulum = incentivePendulumAmount.amount().toNumber()

  let incentivePendulumLight: Color = 'grey'
  if (totalActiveBondAmount.lte(0)) incentivePendulumLight = 'red'
  else if (incentivePendulum < 150) incentivePendulumLight = 'green'
  else if (incentivePendulum < 190) incentivePendulumLight = 'yellow'
  else if (incentivePendulum > 190) incentivePendulumLight = 'red'

  return {
    incentivePendulum,
    incentivePendulumLight,
    totalActiveBondAmount,
    totalPooledRuneAmount
  }
}

export const useIncentivePendulum = (enabled = true): { data: IncentivePendulumRD; reload: FP.Lazy<void> } => {
  const {
    service: { networkInfo$, reloadNetworkInfo }
  } = useMidgardContext()

  const source$ = useMemo((): Rx.Observable<IncentivePendulumRD> => {
    if (!enabled) return Rx.EMPTY
    return FP.pipe(
      networkInfo$,
      RxOp.map(
        RD.map(({ totalPooledRune, bondMetrics: { totalActiveBond } }) =>
          getIncentivePendulum(totalPooledRune, totalActiveBond)
        )
      )
    )
  }, [enabled, networkInfo$])

  const data = useObservableLayoutState(source$, RD.initial)

  return { data, reload: reloadNetworkInfo }
}
