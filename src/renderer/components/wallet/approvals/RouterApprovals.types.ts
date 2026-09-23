import { Address, BaseAmount, TokenAsset } from '@xchainjs/xchain-util'

import { HDMode, WalletType } from '../../../../shared/wallet/types'

export type ApprovalProtocol = 'Thorchain' | 'Mayachain'

export type ApprovalTokenOption = {
  asset: TokenAsset
  contractAddress: Address
  decimals: number
  ticker: string
}

export type ApprovalWalletMeta = {
  fromAddress: Address
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}

/** Stable id for wallet picker options (one owner address + derivation). */
export type ApprovalWalletOption = ApprovalWalletMeta & {
  id: string
}

export const approvalWalletOptionId = (meta: ApprovalWalletMeta): string =>
  `${meta.walletType}-${meta.fromAddress}-${meta.walletAccount}-${meta.walletIndex}-${meta.hdMode}`

export type FormattedAllowance = {
  formatted: string
  raw: string
  isUnlimited: boolean
  amount: BaseAmount
}
