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

export type ChurnPoint = {
  churnHeight: number
  date: Date
  amount: BaseAmount
}

export type ProviderRewards = {
  totalPaid: BaseAmount
  churnCount: number
  lastChurnTotal: O.Option<BaseAmount>
  series: ChurnPoint[]
  payouts: BondPayout[]
}

export type NodeProviderRewards = {
  nodeAddress: Address
  churnsPaid: number
  lastPayout: O.Option<BaseAmount>
  totalPaid: BaseAmount
  series: ChurnPoint[]
}

export type NodeApyPoint = {
  churnHeight: number
  date: Date
  apy: number
}

export type NodeBondPoint = {
  churnHeight: number
  date: Date
  bond: BaseAmount
}

export type NodeHistory = {
  apySeries: NodeApyPoint[]
  bondSeries: NodeBondPoint[]
  earningsSeries: ChurnPoint[]
}

export type ProviderRewardsRD = RD.RemoteData<Error, ProviderRewards>
export type ProviderRewardsLD = LiveData<Error, ProviderRewards>

export type NodeProviderRewardsRD = RD.RemoteData<Error, NodeProviderRewards[]>
export type NodeProviderRewardsLD = LiveData<Error, NodeProviderRewards[]>

export type NodeHistoryRD = RD.RemoteData<Error, NodeHistory>
export type NodeHistoryLD = LiveData<Error, NodeHistory>
