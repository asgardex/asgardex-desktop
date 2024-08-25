import { WalletType } from '../../../shared/wallet/types'
import { Route } from '../types'
import { base as poolsBase } from './base'

export const base: Route<void> = {
  template: `${poolsBase.template}/lending`,
  path() {
    return this.template
  }
}

export type LoanRouteTargetWalletType = WalletType | 'custom'

export type LoanRouteParams = {
  asset: string
  walletType: WalletType
  borrowAsset: string
  borrowWalletType: LoanRouteTargetWalletType
  recipient?: string
}

export const borrow: Route<LoanRouteParams> = {
  template: `${base.template}/:asset/borrow/:walletType/:borrowAsset/:borrowWalletType/:recipient`,
  path: ({ asset, walletType, borrowAsset, borrowWalletType, recipient }) =>
    `${
      base.template
    }/${asset.toLowerCase()}/borrow/${walletType}/${borrowAsset.toLowerCase()}/${borrowWalletType}/${recipient}`
}

export const repay: Route<LoanRouteParams> = {
  template: `${base.template}/:asset/repay/:walletType/:borrowAsset`,
  path: ({ asset, walletType, borrowAsset }) =>
    `${base.template}/${asset.toLowerCase()}/repay/${walletType}/${borrowAsset.toLowerCase()}`
}
