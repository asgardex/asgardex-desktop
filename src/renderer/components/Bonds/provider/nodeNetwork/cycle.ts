import { BaseAmount, baseAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'

import { THORCHAIN_DECIMAL } from '../../../../helpers/assetHelper'
import type { ChurnConstants } from '../../../../hooks/useChurnConstants'
import { NodeInfo } from '../../../../services/thorchain/types'
import { MAX_FEE_BPS, operatorFeeBps } from '../helpers'
import { isFiniteNumber, zeroRune } from './common'

export type CycleEstimate = {
  award: BaseAmount
  operatorShare: BaseAmount
  providersShare: BaseAmount
  feeBps: number
  progress: number
}

export const cycleEstimate = (
  node: NodeInfo,
  nextChurn: { blocksLeft: number } | undefined,
  constants: ChurnConstants
): CycleEstimate => {
  const award = node.award.amount().isFinite() ? node.award : zeroRune()
  const feeBps = Math.min(Math.max(operatorFeeBps(node.bondProviders.nodeOperatorFee) || 0, 0), MAX_FEE_BPS)
  const operatorShare = baseAmount(
    award.amount().times(feeBps).div(MAX_FEE_BPS).integerValue(BigNumber.ROUND_DOWN),
    THORCHAIN_DECIMAL
  )
  const providersShare = baseAmount(award.amount().minus(operatorShare.amount()), THORCHAIN_DECIMAL)
  const interval = constants.churnInterval
  const progress =
    nextChurn && interval > 0 && isFiniteNumber(nextChurn.blocksLeft)
      ? Math.min(Math.max((interval - nextChurn.blocksLeft) / interval, 0), 1)
      : 0
  return { award, operatorShare, providersShare, feeBps, progress }
}
