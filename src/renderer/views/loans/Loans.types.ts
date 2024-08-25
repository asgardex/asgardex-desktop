import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, Asset, Address } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
//tobefixed
export type LoansTableRowData = {
  asset: Asset
  collateralPrice: BaseAmount
  collateral: BaseAmount
  filled: BigNumber
  debt: BaseAmount
  key: string
  network: Network
  watched: boolean
}

export type LoansTableRowsData = LoansTableRowData[]

export type UpdateBorrowerProvider = { address: Address; asset: Asset }
