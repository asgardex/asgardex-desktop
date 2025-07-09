import { AnyAsset, BaseAmount } from '@xchainjs/xchain-util'

export enum TcyOperation {
  Claim = 'Claim',
  Stake = 'Stake',
  Unstake = 'Unstake'
}

export type TcyInfo = {
  asset: AnyAsset
  amount: BaseAmount
  isClaimed: boolean
  memo: string
}
