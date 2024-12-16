import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'

import { WalletType } from '../../../shared/wallet/types'
import { Route } from '../types'
import { base as poolsBase } from './base'

export const base: Route<void> = {
  template: `${poolsBase.template}/deposit`,
  path() {
    return this.template
  }
}
export type DepositRouteParams = {
  protocol?: Chain
  asset: string
  assetWalletType: WalletType
  runeWalletType: WalletType
}
export const deposit: Route<DepositRouteParams> = {
  template: `${base.template}/:protocol/:asset/:assetWalletType/:runeWalletType`,
  path: ({ protocol = THORChain, asset, assetWalletType, runeWalletType }) => {
    // Don't accept empty string for asset
    if (asset) {
      return `${base.template}/${protocol}/${asset.toLowerCase()}/${assetWalletType}/${runeWalletType}`
    }
    // Redirect to base route if asset param is empty
    return base.path()
  }
}
