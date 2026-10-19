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
  nodeEarningsSeries: ChurnPoint[]
}

export type LastChurnPayout = {
  blockNumber: number
  timestamp: string
  date: Date
  amount: BaseAmount
}

export type OperatorNodeRewards = {
  nodeAddress: Address
  totalPaid: BaseAmount
  churnsPaid: number
  lastPayout: LastChurnPayout | null
}

export type OperatorPayout = {
  blockNumber: number
  timestamp: string
  date: Date
  nodeAddress: Address
  commissionAmount: BaseAmount
  commissionBps: number
}

export type OperatorRewards = {
  address: Address
  totals: {
    totalPaid: BaseAmount
    churnCount: number
    lastChurn: LastChurnPayout | null
  }
  series: ChurnPoint[]
  byNode: OperatorNodeRewards[]
  payouts: OperatorPayout[]
  payoutsTotal: number
}

export type NodeProvider = {
  providerAddress: Address
  bondAmount: BaseAmount
  firstSeenBlockNumber: number
  churnsBonded: number
  churnsSinceFirstSeen: number
  lastPayout: LastChurnPayout | null
}

export type NodeProviders = {
  nodeAddress: Address
  blockNumber: number
  timestamp: string
  date: Date
  providers: NodeProvider[]
}

export type NodeDelistReason = 'operator' | 'vault_depleted' | 'removed'

export type NodeListingDetails = {
  operatorAddress: Address
  minBond: BaseAmount
  targetTotalBond: BaseAmount | null
  feeBps: number
  name: string | null
  description: string | null
  listedAt: string
  listedDate: Date
  listedHeight: number
  txId: string
  delisted: boolean
  delistedTxId: string | null
  delistReason: NodeDelistReason | null
}

export type NodeListing = {
  nodeAddress: Address
  listed: boolean
  listing: NodeListingDetails | null
}

export type WhitelistRequestStatus = 'pending' | 'approved' | 'bonded' | 'rejected'

export type WhitelistRequest = {
  id: number
  nodeAddress: Address
  providerAddress: Address
  intendedBond: BaseAmount
  realBond: BaseAmount
  status: WhitelistRequestStatus
  requestedAt: string
  requestedDate: Date
  height: number
  txId: string
}

export type WhitelistRequestCounts = {
  pending: number
  approved: number
  bonded: number
  rejected: number
}

export type NodeWhitelistRequests = {
  nodeAddress: Address
  counts: WhitelistRequestCounts
  requests: WhitelistRequest[]
  total: number
}

export type OperatorNodeWhitelistRequests = {
  nodeAddress: Address
  pending: number
}

export type OperatorWhitelistRequests = {
  address: Address
  counts: WhitelistRequestCounts
  nodes: OperatorNodeWhitelistRequests[]
  requests: WhitelistRequest[]
  total: number
}

export type FinderFeeVaultLevel = 'ok' | 'warning' | 'critical' | 'depleted'

export type OperatorFinderFeeVault = {
  address: Address
  known: boolean
  balance: BaseAmount
  depleted: boolean
  level: FinderFeeVaultLevel
  listedNodes: number
  delistedByVault: number
  lastUpdatedAt: string | null
}

export type ProviderRewardsRD = RD.RemoteData<Error, ProviderRewards>
export type ProviderRewardsLD = LiveData<Error, ProviderRewards>

export type NodeProviderRewardsRD = RD.RemoteData<Error, NodeProviderRewards[]>
export type NodeProviderRewardsLD = LiveData<Error, NodeProviderRewards[]>

export type NodeHistoryRD = RD.RemoteData<Error, NodeHistory>
export type NodeHistoryLD = LiveData<Error, NodeHistory>

export type OperatorRewardsRD = RD.RemoteData<Error, OperatorRewards>
export type OperatorRewardsLD = LiveData<Error, OperatorRewards>

export type NodeProvidersRD = RD.RemoteData<Error, NodeProviders>
export type NodeProvidersLD = LiveData<Error, NodeProviders>

export type NodeListingRD = RD.RemoteData<Error, NodeListing>
export type NodeListingLD = LiveData<Error, NodeListing>

export type NodeWhitelistRequestsRD = RD.RemoteData<Error, NodeWhitelistRequests>
export type NodeWhitelistRequestsLD = LiveData<Error, NodeWhitelistRequests>

export type OperatorWhitelistRequestsRD = RD.RemoteData<Error, OperatorWhitelistRequests>
export type OperatorWhitelistRequestsLD = LiveData<Error, OperatorWhitelistRequests>

export type OperatorFinderFeeVaultRD = RD.RemoteData<Error, OperatorFinderFeeVault>
export type OperatorFinderFeeVaultLD = LiveData<Error, OperatorFinderFeeVault>
