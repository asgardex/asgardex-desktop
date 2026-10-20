import * as RD from '@devexperts/remote-data-ts'

import type { TradeAccount } from '../../../services/thorchain/types'

const hasPositiveUnits = (accounts: TradeAccount[]) => accounts.some((account) => account.units.gt(0))

/**
 * Deposit is for an empty trade account on this chart.
 * The other dex hides it only once that account is known to hold funds.
 * A pending, failed, or missing probe on the other dex does not block the button.
 */
export const offerTradeDepositFor = (
  chartRd: RD.RemoteData<Error, TradeAccount[]>,
  otherRd: RD.RemoteData<Error, TradeAccount[]>
): boolean => {
  if (!RD.isSuccess(chartRd) || hasPositiveUnits(chartRd.value)) return false
  return !(RD.isSuccess(otherRd) && hasPositiveUnits(otherRd.value))
}
