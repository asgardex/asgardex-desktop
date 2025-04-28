import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, AnyAsset } from '@xchainjs/xchain-util'

import { GetPoolsStatusEnum } from '../../services/midgard/midgardTypes'

// List of assets used for pricing
export type PricePoolAsset = AnyAsset
export type PricePoolAssets = PricePoolAsset[]

export type PricePoolCurrencyWeights = Record<string, number>

export type PoolTableRowData = {
  asset: AnyAsset
  depthAmount: BaseAmount
  depthPrice: BaseAmount
  volumeAmount: BaseAmount
  volumePrice: BaseAmount
  poolPrice: BaseAmount
  apy: number
  status: GetPoolsStatusEnum
  deepest?: boolean
  key: string
  network: Network
  watched: boolean
}

export type PoolTableRowsData = PoolTableRowData[]
