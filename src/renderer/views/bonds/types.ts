import { Address, BaseAmount } from '@xchainjs/xchain-util'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { NodeStatusEnum, Providers } from '../../services/thorchain/types'

export type WalletAddressInfo = {
  address: string
  walletType: WalletType
}

export type BondWalletInfo = {
  address: Address
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}

export type BondProviderPosition = {
  nodeAddress: Address
  status: NodeStatusEnum
  signMembership: string[]
  myBond: BaseAmount
  nodeBond: BaseAmount
  nodeOperatorFee: BaseAmount
  providers: Providers[]
  signer: BondWalletInfo
}
