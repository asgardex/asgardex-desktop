import * as RD from '@devexperts/remote-data-ts'
import { CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { BaseAmount, baseAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import { useObservableState } from 'observable-hooks'
import * as RxOp from 'rxjs/operators'

import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'

export type Color = 'green' | 'yellow' | 'red' | 'grey'

export type IncentivePendulum = {
  totalActiveBondAmount: BaseAmount
  totalPooledRuneAmount: BaseAmount
  incentivePendulum: number // percent
  incentivePendulumLight: Color
}

export type IncentivePendulumRD = RD.RemoteData<Error, IncentivePendulum>

export const getIncentivePendulum = (totalPooledRune: string, totalActiveBond: string): IncentivePendulum => {
  const totalActiveBondAmount = baseAmount(totalActiveBond, CACAO_DECIMAL)
  const totalPooledRuneAmount = baseAmount(totalPooledRune, CACAO_DECIMAL)
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

export const useIncentivePendulumMaya = (): { data: IncentivePendulumRD; reload: FP.Lazy<void> } => {
  const {
    service: { networkInfo$, reloadNetworkInfo }
  } = useMidgardMayaContext()

  const [data] = useObservableState<IncentivePendulumRD>(
    () =>
      FP.pipe(
        networkInfo$,
        RxOp.map(
          RD.map(({ totalPooledRune, bondMetrics: { totalActiveBond } }) =>
            getIncentivePendulum(totalPooledRune, totalActiveBond)
          )
        ),
        RxOp.shareReplay(1)
      ),
    RD.initial
  )

  return { data, reload: reloadNetworkInfo }
}
