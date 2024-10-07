import * as RD from '@devexperts/remote-data-ts'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { BaseAmount, baseAmount, assetFromString } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'

import * as PoolHelpers from '../../helpers/poolHelper'
import { SaverProvider, SaverProviderRD } from '../../services/thorchain/types'
import { PricePool } from '../pools/Pools.types'

export const getSaversTotal = (
  allSaverProviders: Record<string, SaverProviderRD>,
  poolDetails: PoolDetails,
  pricePoolData: PricePool
): BaseAmount => {
  return Object.entries(allSaverProviders).reduce((acc, [assetString, saverProviderRD]) => {
    return RD.fold<Error, SaverProvider, BaseAmount>(
      () => acc,
      () => acc,
      () => acc,
      (saverProvider) => {
        const asset = assetFromString(assetString)
        if (!asset) return acc

        // Get redeem or redeem values
        const redeemValue = saverProvider.redeemValue

        const depositPrice = PoolHelpers.getPoolPriceValue({
          balance: { asset, amount: redeemValue }, // Use extracted asset
          poolDetails,
          pricePool: pricePoolData
        })
        const depositPriceBaseAmount = O.getOrElse(() => baseAmount(0, redeemValue.decimal))(depositPrice)

        return acc.plus(depositPriceBaseAmount) // Sum up deposit amounts
      }
    )(saverProviderRD)
  }, baseAmount(0))
}
