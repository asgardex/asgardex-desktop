import * as RD from '@devexperts/remote-data-ts'
import { ARB_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-arbitrum'
import { BTC_DECIMAL } from '@xchainjs/xchain-bitcoin'
import { BCH_DECIMAL } from '@xchainjs/xchain-bitcoincash'
import { BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { ADA_DECIMALS } from '@xchainjs/xchain-cardano'
import { DASH_DECIMAL } from '@xchainjs/xchain-dash'
import { ETH_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-ethereum'
import { CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { EthChain } from '@xchainjs/xchain-mayachain-query'
import { PoolDetail as MayaPoolDetail } from '@xchainjs/xchain-mayamidgard'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { XRD_DECIMAL } from '@xchainjs/xchain-radix'
import { SOL_DECIMALS } from '@xchainjs/xchain-solana'
import { isTCYAsset } from '@xchainjs/xchain-thorchain'
import { ThorchainCache } from '@xchainjs/xchain-thorchain-query'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import { ZEC_DECIMAL } from '@xchainjs/xchain-zcash'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isMayaSupportedAsset, isTCSupportedAsset } from '../../../shared/utils/asset'
import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import {
  isAdaChain,
  isArbChain,
  isBchChain,
  isBscChain,
  isBtcChain,
  isDashChain,
  isKujiChain,
  isMayaChain,
  isSolChain,
  isThorChain,
  isXrdChain,
  isZecChain
} from '../../helpers/chainHelper'
import { KUJI_DECIMAL } from '../kuji/const'
import { AssetWithDecimalLD } from './types'

/**
 * Gets asset decimal from pool details or falls back to hardcoded values
 * @param asset - The asset to get decimals for
 * @param thorPoolDetails - THORChain pool details (optional)
 * @param mayaPoolDetails - MAYAChain pool details (optional)
 * @returns Promise<number> - The decimal count for the asset
 */
export const getDecimal = (
  asset: AnyAsset,
  thorPoolDetails?: PoolDetail[],
  mayaPoolDetails?: MayaPoolDetail[]
): Promise<number> => {
  const { chain } = asset

  // Check hardcoded decimals first for native chain assets
  if (isArbChain(chain)) {
    return Promise.resolve(ARB_GAS_ASSET_DECIMAL)
  }
  if (isBscChain(chain)) {
    return Promise.resolve(BSC_GAS_ASSET_DECIMAL)
  }
  if (isThorChain(chain)) {
    return Promise.resolve(THORCHAIN_DECIMAL)
  }
  if (isMayaChain(chain)) {
    return Promise.resolve(CACAO_DECIMAL)
  }
  if (isDashChain(chain)) {
    return Promise.resolve(DASH_DECIMAL)
  }
  if (isKujiChain(chain)) {
    return Promise.resolve(KUJI_DECIMAL)
  }
  if (isXrdChain(chain)) {
    return Promise.resolve(XRD_DECIMAL)
  }
  if (isBtcChain(chain)) {
    return Promise.resolve(BTC_DECIMAL)
  }
  if (isBchChain(chain)) {
    return Promise.resolve(BCH_DECIMAL)
  }
  if (isSolChain(chain)) {
    return Promise.resolve(SOL_DECIMALS)
  }
  if (isZecChain(chain)) {
    return Promise.resolve(ZEC_DECIMAL)
  }
  if (isAdaChain(chain)) {
    return Promise.resolve(ADA_DECIMALS)
  }
  if (isZecChain(chain)) {
    return Promise.resolve(ZEC_DECIMAL)
  }
  if (isTCYAsset(asset)) {
    return Promise.resolve(THORCHAIN_DECIMAL)
  }
  // Fix until Decimals for maya midgard is completed.
  if (
    asset.chain === EthChain &&
    asset.symbol.toLowerCase() === String('PEPE-0x6982508145454Ce325dDbE47a25d4ec3d2311933').toLowerCase()
  ) {
    return Promise.resolve(ETH_GAS_ASSET_DECIMAL)
  }

  // Try to find the asset in MAYAChain pool details first
  if (mayaPoolDetails && isMayaSupportedAsset(asset, mayaPoolDetails)) {
    const mayaPoolDetail = mayaPoolDetails.find((pool) => {
      const poolAsset = pool.asset.toUpperCase()
      const assetString = assetToString(asset).toUpperCase()
      return (
        poolAsset === assetString ||
        poolAsset === assetString.replace('-', '.') ||
        poolAsset === assetString.replace('/', '.')
      )
    })

    if (mayaPoolDetail && mayaPoolDetail.nativeDecimal && mayaPoolDetail.nativeDecimal !== '-1') {
      return Promise.resolve(parseInt(mayaPoolDetail.nativeDecimal, 10))
    }
  }

  // Try to find the asset in THORChain pool details
  if (thorPoolDetails && isTCSupportedAsset(asset, thorPoolDetails)) {
    const thorPoolDetail = thorPoolDetails.find((pool) => {
      const poolAsset = pool.asset.toUpperCase()
      const assetString = assetToString(asset).toUpperCase()
      return (
        poolAsset === assetString ||
        poolAsset === assetString.replace('-', '.') ||
        poolAsset === assetString.replace('~', '.')
      )
    })

    if (thorPoolDetail && thorPoolDetail.nativeDecimal && thorPoolDetail.nativeDecimal !== '-1') {
      return Promise.resolve(parseInt(thorPoolDetail.nativeDecimal, 10))
    }
  }

  // Fallback to the original implementation with proper error handling
  try {
    const thorchainCache = new ThorchainCache()

    return Rx.from(
      thorchainCache.midgardQuery.getDecimalForAsset({
        chain: asset.chain,
        ticker: asset.ticker,
        symbol: asset.symbol.toUpperCase(),
        type: asset.type
      })
    )
      .toPromise()
      .catch((error) => {
        console.warn(`Failed to get decimal for asset ${assetToString(asset)}:`, error)
        // Return a sensible default - most tokens use 18 decimals
        return 18
      })
  } catch (error) {
    console.warn(`Failed to get decimal for asset ${assetToString(asset)}:`, error)
    // Return a sensible default - most tokens use 18 decimals
    return Promise.resolve(18)
  }
}

export const assetWithDecimal$ = (
  asset: AnyAsset,
  thorPoolDetails?: PoolDetail[],
  mayaPoolDetails?: MayaPoolDetail[]
): AssetWithDecimalLD =>
  Rx.from(getDecimal(asset, thorPoolDetails, mayaPoolDetails)).pipe(
    RxOp.map((decimal) =>
      RD.success({
        asset,
        decimal
      })
    ),
    RxOp.catchError((error) => Rx.of(RD.failure(error?.msg ?? error.toString()))),
    RxOp.startWith(RD.pending)
  )
