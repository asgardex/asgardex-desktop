import { WalletType } from '../../../shared/wallet/types'
import { Route } from '../types'
import { base as poolsBase } from './base'

export const base: Route<void> = {
  template: `${poolsBase.template}/loans`,
  path() {
    return this.template
  }
}

export type LoanRouteParams = { asset: string; walletType: WalletType }

export const earn: Route<LoanRouteParams> = {
  template: `${base.template}/:asset/loanOpen/:walletType`,
  path: ({ asset, walletType }) => `${base.template}/${asset.toLowerCase()}/loanOpen/${walletType}`
}

export const withdraw: Route<LoanRouteParams> = {
  template: `${base.template}/:asset/loanClose/:walletType`,
  path: ({ asset, walletType }) => `${base.template}/${asset.toLowerCase()}/loanClose/${walletType}`
}
