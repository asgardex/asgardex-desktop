import { BaseAmount, formatAssetAmountCurrency, baseToAsset, AnyAsset } from '@xchainjs/xchain-util'

import { getTwoSigfigAssetAmount } from '../../../helpers/assetHelper'

export const formatFee = ({ amount, asset }: { amount: BaseAmount; asset: AnyAsset }) =>
  formatAssetAmountCurrency({
    amount: getTwoSigfigAssetAmount(baseToAsset(amount)),
    asset,
    trimZeros: true
  })
