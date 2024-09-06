import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, Address, AnyAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
//tobefixed
export type LoansTableRowData = {
  asset: AnyAsset
  collateralPrice: BaseAmount
  collateral: BaseAmount
  filled: BigNumber
  debt: BaseAmount
  key: string
  network: Network
  watched: boolean
}

export type LoansTableRowsData = LoansTableRowData[]

export type UpdateBorrowerProvider = { address: Address; asset: AnyAsset }
