import { Address, BaseAmount } from '@xchainjs/xchain-util'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { NodeStatusEnum, Providers } from '../../services/thorchain/types'

export type WalletAddressInfo = {
  address: string
  walletType: WalletType
}

/**
 * Full wallet info of a THOR address — everything needed to sign a MsgDeposit
 */
export type BondWalletInfo = {
  address: Address
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}

/**
 * A bond position: one wallet address listed as bond provider on one node
 */
export type BondProviderPosition = {
  nodeAddress: Address
  status: NodeStatusEnum
  /** vault pubkeys the node is a member of — non-empty means it has not churned out yet */
  signMembership: string[]
  /** bond of `signer.address` on this node */
  myBond: BaseAmount
  /** total bond of the node */
  nodeBond: BaseAmount
  nodeOperatorFee: BaseAmount
  /** all bond providers of the node (for the providers breakdown) */
  providers: Providers[]
  /** wallet address/type to sign bond/unbond txs with */
  signer: BondWalletInfo
}
