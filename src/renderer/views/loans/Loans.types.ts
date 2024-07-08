import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, Asset, Address } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
//tobefixed
export type LoansTableRowData = {
  asset: Asset
  depthPrice: BaseAmount
  depth: BaseAmount
  filled: BigNumber
  apr: BigNumber
  key: string
  network: Network
  watched: boolean
}

export type LoansTableRowsData = LoansTableRowData[]

export type UpdateBorrowerProvider = { address: Address; asset: Asset }
