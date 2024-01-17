import { BaseAmount, Asset } from '@xchainjs/xchain-util'
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray'

import { Network } from '../../../shared/api/types'
import { GetPoolsStatusEnum } from '../../services/midgard/types'

// List of assets used for pricing
export type PricePoolAsset = Asset
export type PricePoolAssets = PricePoolAsset[]

export type PricePoolCurrencyWeights = Record<string, number>

export type PoolData = {
  assetBalance: BaseAmount
  runeBalance: BaseAmount
}
// TODO (@asgdx-team) Move all PricePool* types into `src/renderer/services/midgard/types.ts`
export type PricePool = {
  readonly asset: PricePoolAsset
  readonly poolData: PoolData
}
export type PricePools = NonEmptyArray<PricePool>

export type PoolTableRowData = {
  asset: Asset
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
