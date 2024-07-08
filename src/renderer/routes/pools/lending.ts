import { WalletType } from '../../../shared/wallet/types'
import { Route } from '../types'
import { base as poolsBase } from './base'

export const base: Route<void> = {
  template: `${poolsBase.template}/lending`,
  path() {
    return this.template
  }
}

export type LoanRouteParams = { asset: string; walletType: WalletType }

export const borrow: Route<LoanRouteParams> = {
  template: `${base.template}/:asset/borrow/:walletType`,
  path: ({ asset, walletType }) => `${base.template}/${asset.toLowerCase()}/borrow/${walletType}`
}

export const repay: Route<LoanRouteParams> = {
  template: `${base.template}/:asset/repay/:walletType`,
  path: ({ asset, walletType }) => `${base.template}/${asset.toLowerCase()}/repay/${walletType}`
}
