import { AnyAsset } from '@xchainjs/xchain-util'

export enum TcyOperation {
  Claim = 'Claim',
  Stake = 'Stake',
  Unstake = 'Unstake'
}

export type TcyInfo = {
  asset: AnyAsset
  amount: number
  isClaimed: boolean
}
