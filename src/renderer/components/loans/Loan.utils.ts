import { AnyAsset, BaseAmount, Chain, baseAmount } from '@xchainjs/xchain-util'

import { DefaultChainAttributes } from '../../../shared/utils/chain'
import { ZERO_BASE_AMOUNT } from '../../const'
import { isChainAsset, max1e8BaseAmount } from '../../helpers/assetHelper'
import { getChainAsset } from '../../helpers/chainHelper'
import { SaverDepositFees, WithdrawAssetFees } from '../../services/chain/types'

/**
 * Calculates max. balance available to swap
 * In some cases fees needs to be deducted from given amount
 *
 * assetAmountMax1e8 => balances of source asset (max 1e8)
 * feeAmount => fee of inbound tx
 */
export const maxAmountToLoanMax1e8 = ({
  asset,
  balanceAmountMax1e8,
  feeAmount
}: {
  asset: AnyAsset
  balanceAmountMax1e8: BaseAmount
  feeAmount: BaseAmount
}): BaseAmount => {
  // Ignore non-chain assets
  if (!isChainAsset(asset)) return balanceAmountMax1e8

  const estimatedFee = max1e8BaseAmount(feeAmount)
  const maxAmountToSwap = balanceAmountMax1e8.minus(estimatedFee)
  return maxAmountToSwap.gt(baseAmount(0)) ? maxAmountToSwap : baseAmount(0)
}

/**
 * Returns zero sym deposit fees
 * by given paired asset to deposit
 */
export const getZeroLoanDepositFees = (asset: AnyAsset): SaverDepositFees => ({
  asset: {
    asset: getChainAsset(asset.chain),
    inFee: ZERO_BASE_AMOUNT,
    outFee: ZERO_BASE_AMOUNT,
    refundFee: ZERO_BASE_AMOUNT
  }
})

/**
 * Returns zero sym deposit fees
 * by given paired asset to deposit
 */
export const getZeroLoanWithdrawFees = (asset: AnyAsset): WithdrawAssetFees => ({
  asset,
  inFee: ZERO_BASE_AMOUNT,
  outFee: ZERO_BASE_AMOUNT
})

export const getBlockDate = (currentBlock: number, targetBlock: number, chain: Chain): Date => {
  const blockDifference = targetBlock - currentBlock
  const avgBlockTimeInSecs = DefaultChainAttributes[chain].avgBlockTimeInSecs
  const timeDifferenceInSecs = blockDifference * avgBlockTimeInSecs
  const newDate = new Date()
  newDate.setSeconds(newDate.getSeconds() + timeDifferenceInSecs)
  return newDate
}
