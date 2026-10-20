import { BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'

import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'

/**
 * Display cap for a pay amount. Wallet balances can be 18 dp; the ticket
 * shows at most THORChain's 8 and never rounds up.
 */
export const formatSwapAmount = (amount: BaseAmount): string => trimSwapAmount(baseToAsset(amount).amount())

export const swapAmountFromPercent = (amount: BaseAmount, percent: number): string =>
  trimSwapAmount(baseToAsset(amount).amount().multipliedBy(percent).div(100))

/** True when `balance` can pay `cost`. The two amounts may use different decimals. */
export const balanceCovers = (balance: BaseAmount, cost: BaseAmount): boolean => {
  if (!cost.amount().gt(0)) return false
  return baseToAsset(balance).amount().gte(baseToAsset(cost).amount())
}

/** True when `balance` can pay a typed asset amount such as the sell size. */
export const assetAmountCovers = (balance: BaseAmount, amount: number): boolean => {
  if (!Number.isFinite(amount) || amount <= 0) return false
  return baseToAsset(balance).amount().gte(amount)
}

/** Counter received per 1 unit of the sized asset. Null when either side is empty. */
export const pairRate = (sizeText: string, output: BaseAmount): string | null => {
  const size = new BigNumber(sizeText)
  if (!size.isFinite() || !size.gt(0)) return null
  const out = baseToAsset(output).amount()
  if (!out.isFinite() || !out.gt(0)) return null
  const trimmed = out
    .div(size)
    .decimalPlaces(THORCHAIN_DECIMAL, BigNumber.ROUND_DOWN)
    .toFixed()
    .replace(/\.?0+$/, '')
  return trimmed === '' || trimmed === '0' ? null : trimmed
}

const trimSwapAmount = (value: BigNumber): string => {
  const capped = value.decimalPlaces(THORCHAIN_DECIMAL, BigNumber.ROUND_DOWN)
  const text = capped.toFixed(THORCHAIN_DECIMAL).replace(/\.?0+$/, '')
  return text === '' || text === '-' ? '0' : text
}
