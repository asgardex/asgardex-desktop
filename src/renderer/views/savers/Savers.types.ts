import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, AnyAsset, Address } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'

export type SaversTableRowData = {
  asset: AnyAsset
  depthPrice: BaseAmount
  depth: BaseAmount
  filled: BigNumber
  apr: BigNumber
  key: string
  network: Network
  watched: boolean
}

export type SaversTableRowsData = SaversTableRowData[]

export type UpdateSaverProvider = { address: Address; asset: AnyAsset }
