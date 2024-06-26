import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, Asset, Address } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'

export type SaversTableRowData = {
  asset: Asset
  depthPrice: BaseAmount
  depth: BaseAmount
  filled: BigNumber
  apr: BigNumber
  key: string
  network: Network
  watched: boolean
}

export type SaversTableRowsData = SaversTableRowData[]
//tobefixd
export type UpdateSaverProvider = { address: Address; asset: Asset }
