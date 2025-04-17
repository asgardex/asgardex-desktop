import { AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'

import { PoolShareType } from '../../services/midgard/midgardTypes'

export type PoolShareTableRowData = {
  asset: AnyAsset
  runeShare: BaseAmount
  assetShare: BaseAmount
  sharePercent: BigNumber
  assetDepositPrice: BaseAmount
  runeDepositPrice: BaseAmount
  type: PoolShareType
}

export type PoolShareTableData = PoolShareTableRowData[]
