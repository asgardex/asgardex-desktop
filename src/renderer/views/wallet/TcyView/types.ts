import { Address, AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import { WalletType } from '../../../../shared/wallet/types'

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
  l1Address: Address
  walletType: WalletType
}
