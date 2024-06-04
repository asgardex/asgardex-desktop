import { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address } from '@xchainjs/xchain-util'
import { Asset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import { Dex } from '../../shared/api/types'
import { useMayachainContext } from '../contexts/MayachainContext'
import { useThorchainContext } from '../contexts/ThorchainContext'
import { eqAddress, eqOString } from '../helpers/fp/eq'
import { sequenceTOption } from '../helpers/fpHelpers'
import {
  LiquidityProvider,
  LiquidityProviderAssetMismatchRD,
  LiquidityProviderHasAsymAssets,
  LiquidityProviderHasAsymAssetsRD,
  LiquidityProviderRD,
  LiquidityProvidersRD,
  PendingAssetsRD
} from '../services/thorchain/types'
import { AssetsWithAmount1e8 } from '../types/asgardex'

export const useLiquidityProviders = ({
  asset,
  dexAssetAddress,
  assetAddress,
  dex
}: {
  asset: Asset
  dexAssetAddress: Address
  assetAddress: Address
  dex: Dex
}) => {
  const { getLiquidityProviders: getLiquidityProvidersThor } = useThorchainContext()
  const { getLiquidityProviders: getLiquidityProvidersMaya } = useMayachainContext()

  const [providers, setProviders] = useState<LiquidityProvidersRD>(RD.initial)

  useEffect(() => {
    // Determine the correct function based on the current value of `dex`
    const getLiquidityProviders = dex.chain === 'THOR' ? getLiquidityProvidersThor : getLiquidityProvidersMaya

    // Create the observable and subscribe
    const subscription = getLiquidityProviders(asset).subscribe(setProviders)

    // Cleanup the subscription when the component unmounts or when `dex` or `asset` changes
    return () => subscription.unsubscribe()
  }, [dex, asset, getLiquidityProvidersThor, getLiquidityProvidersMaya])

  /**
   * Gets liquidity provider data by given RUNE + asset address
   * Sym. deposit only
   */
  const symLiquidityProvider: LiquidityProviderRD = useMemo(
    () =>
      FP.pipe(
        providers,
        RD.map(
          A.findFirst(
            (provider) =>
              eqOString.equals(provider.dexAssetAddress, O.some(dexAssetAddress)) &&
              eqOString.equals(provider.assetAddress, O.some(assetAddress))
          )
        )
      ),
    [assetAddress, providers, dexAssetAddress]
  )

  /**
   * Pending assets by given RUNE + asset address
   * Sym. deposit only
   */
  const symPendingAssets: PendingAssetsRD = useMemo(
    () =>
      FP.pipe(
        symLiquidityProvider,
        // transform `LiquidityProvider` -> `PendingAssets`
        RD.map((oLiquidityProvider) =>
          FP.pipe(
            oLiquidityProvider,
            O.map(({ pendingAsset, pendingDexAsset }) => [pendingAsset, pendingDexAsset]),
            // filter `None` out from list
            O.map(A.filterMap(FP.identity)),
            O.getOrElse<AssetsWithAmount1e8>(() => [])
          )
        )
      ),
    [symLiquidityProvider]
  )

  const asymLiquidityProviders: LiquidityProvidersRD = useMemo(
    () =>
      FP.pipe(
        providers,
        RD.map(
          A.filter(
            (provider) =>
              // rune side
              (eqOString.equals(provider.dexAssetAddress, O.some(dexAssetAddress)) &&
                O.isNone(provider.assetAddress)) ||
              // asset side
              (eqOString.equals(provider.assetAddress, O.some(assetAddress)) && O.isNone(provider.dexAssetAddress))
          )
        )
      ),
    [providers, dexAssetAddress, assetAddress]
  )

  /**
   * Checks whether LP has already an asym. deposit or not
   */
  const hasAsymAssets: LiquidityProviderHasAsymAssetsRD = useMemo(
    () =>
      FP.pipe(
        asymLiquidityProviders,
        RD.map((providers) =>
          FP.pipe(
            providers,
            A.reduce<LiquidityProvider, LiquidityProviderHasAsymAssets>(
              { asset: false, dexAsset: false },
              (acc, provider) => ({
                asset: O.isSome(provider.assetAddress) || acc.asset,
                dexAsset: O.isSome(provider.dexAssetAddress) || acc.dexAsset
              })
            )
          )
        )
      ),
    [asymLiquidityProviders]
  )

  /**
   * Looking into LP data to check a possible asset missmatch
   * That's RUNE or asset side has been already used with another pair
   *
   * Sym. deposits only
   */
  const symAssetMismatch: LiquidityProviderAssetMismatchRD = useMemo(
    () =>
      FP.pipe(
        providers,
        RD.map(
          A.findFirstMap(({ dexAssetAddress: oDexAssetAddress, assetAddress: oAssetAddress }) =>
            FP.pipe(
              sequenceTOption(oDexAssetAddress, oAssetAddress),
              O.chain(([providerDexAssetAddress, providerAssetAddress]) =>
                // check asset side for given RUNE address
                (eqAddress.equals(providerDexAssetAddress.toLowerCase(), dexAssetAddress) &&
                  !eqAddress.equals(providerAssetAddress.toLowerCase(), assetAddress)) ||
                // check rune side for given asset address
                (eqAddress.equals(providerAssetAddress.toLowerCase(), assetAddress) &&
                  !eqAddress.equals(providerDexAssetAddress.toLowerCase(), dexAssetAddress))
                  ? // If there is a missmatch, return this discovered pair (which is a previous deposit pair)
                    O.some({ dexAssetAddress: providerDexAssetAddress, assetAddress: providerAssetAddress })
                  : O.none
              )
            )
          )
        )
      ),
    [assetAddress, providers, dexAssetAddress]
  )

  return {
    symPendingAssets,
    hasAsymAssets,
    symAssetMismatch
  }
}
