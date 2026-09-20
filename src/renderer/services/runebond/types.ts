import * as RD from '@devexperts/remote-data-ts'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'

import { LiveData } from '../../helpers/rx/liveData'

export type BondPayout = {
  nodeAddress: Address
  amount: BaseAmount
  churnHeight: number
  date: Date
}

/**
 * Aggregated per-churn amount (payouts to the provider or node earnings)
 */
export type ChurnPoint = {
  churnHeight: number
  date: Date
  amount: BaseAmount
}

export type ProviderRewards = {
  totalPaid: BaseAmount
  churnCount: number
  /** paid at the most recent churn (across all nodes) */
  lastChurnTotal: O.Option<BaseAmount>
  /** per-churn totals, oldest first (e.g. last 12 churns) */
  series: ChurnPoint[]
  /** individual payouts, newest first */
  payouts: BondPayout[]
}

export type NodeProviderRewards = {
  nodeAddress: Address
  churnsPaid: number
  lastPayout: O.Option<BaseAmount>
  totalPaid: BaseAmount
  /** per-churn payouts, oldest first */
  series: ChurnPoint[]
}

export type NodeApyPoint = {
  churnHeight: number
  date: Date
  /** e.g. 0.214 = 21.4% */
  apy: number
}

export type NodeBondPoint = {
  churnHeight: number
  date: Date
  bond: BaseAmount
}

export type NodeHistory = {
  apySeries: NodeApyPoint[]
  /** provider bond over churns, oldest first */
  bondSeries: NodeBondPoint[]
  /** provider earnings per churn, oldest first */
  earningsSeries: ChurnPoint[]
}

export type ProviderRewardsRD = RD.RemoteData<Error, ProviderRewards>
export type ProviderRewardsLD = LiveData<Error, ProviderRewards>

export type NodeProviderRewardsRD = RD.RemoteData<Error, NodeProviderRewards[]>
export type NodeProviderRewardsLD = LiveData<Error, NodeProviderRewards[]>

export type NodeHistoryRD = RD.RemoteData<Error, NodeHistory>
export type NodeHistoryLD = LiveData<Error, NodeHistory>
