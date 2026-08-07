import * as RD from '@devexperts/remote-data-ts'
import { ARB_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-arbitrum'
import { AVAX_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-avax'
import { BASE_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-base'
import { BTC_DECIMAL } from '@xchainjs/xchain-bitcoin'
import { BCH_DECIMAL } from '@xchainjs/xchain-bitcoincash'
import { BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { ADA_DECIMALS } from '@xchainjs/xchain-cardano'
import { COSMOS_DECIMAL } from '@xchainjs/xchain-cosmos'
import { DASH_DECIMAL } from '@xchainjs/xchain-dash'
import { DOGE_DECIMAL } from '@xchainjs/xchain-doge'
import { ETH_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-ethereum'
import { LTC_DECIMAL } from '@xchainjs/xchain-litecoin'
import { CACAO_DECIMAL, MAYA_DECIMAL } from '@xchainjs/xchain-mayachain'
import { PoolDetail as MayaPoolDetail } from '@xchainjs/xchain-mayamidgard'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { XRD_DECIMAL } from '@xchainjs/xchain-radix'
import { XRP_DECIMAL } from '@xchainjs/xchain-ripple'
import { SOL_DECIMALS } from '@xchainjs/xchain-solana'
import { SUI_DECIMALS } from '@xchainjs/xchain-sui'
import { isTCYAsset } from '@xchainjs/xchain-thorchain'
import { TRX_DECIMAL } from '@xchainjs/xchain-tron'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import { ZEC_DECIMAL } from '@xchainjs/xchain-zcash'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isMayaSupportedAsset, isTCSupportedAsset } from '../../../shared/utils/asset'
import { isMayaAsset, THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { getTokenDecimal } from './tokenDecimalMap'
import { AssetWithDecimalLD } from './types'

/**
 * Gets asset decimal from pool details or falls back to hardcoded values
 * @param asset - The asset to get decimals for
 * @param thorPoolDetails - THORChain pool details (optional)
 * @param mayaPoolDetails - MAYAChain pool details (optional)
 * @returns Promise<number> - The decimal count for the asset
 */
// Chain decimal lookup map for better performance
const CHAIN_DECIMAL_MAP = new Map([
  ['ETH', ETH_GAS_ASSET_DECIMAL],
  ['ARB', ARB_GAS_ASSET_DECIMAL],
  ['AVAX', AVAX_GAS_ASSET_DECIMAL],
  ['BASE', BASE_GAS_ASSET_DECIMAL],
  ['BSC', BSC_GAS_ASSET_DECIMAL],
  ['THOR', THORCHAIN_DECIMAL],
  ['MAYA', CACAO_DECIMAL],
  ['DASH', DASH_DECIMAL],
  ['DOGE', DOGE_DECIMAL],
  ['LTC', LTC_DECIMAL],
  ['GAIA', COSMOS_DECIMAL],
  ['XRD', XRD_DECIMAL],
  ['BTC', BTC_DECIMAL],
  ['BCH', BCH_DECIMAL],
  ['SOL', SOL_DECIMALS],
  ['TRON', TRX_DECIMAL],
  ['XRP', XRP_DECIMAL],
  ['ZEC', ZEC_DECIMAL],
  ['ADA', ADA_DECIMALS],
  ['SUI', SUI_DECIMALS]
])

/**
 * Validates and parses nativeDecimal string from pool details
 * @param nativeDecimal - The nativeDecimal string from pool details
 * @returns Validated decimal number or null if invalid
 */
const validateAndParseDecimal = (nativeDecimal: string | undefined | null): number | null => {
  if (!nativeDecimal) return null

  // Trim whitespace and check for special values
  const trimmed = nativeDecimal.trim()
  if (trimmed === '' || trimmed === '-1') return null

  // Validate format: only digits
  if (!/^\d+$/.test(trimmed)) return null

  // Parse as base 10
  const parsed = parseInt(trimmed, 10)

  // Check for NaN and ensure it's a safe integer in reasonable range (0-30)
  if (isNaN(parsed) || !Number.isSafeInteger(parsed) || parsed < 0 || parsed > 30) {
    return null
  }

  return parsed
}

export const getDecimalSync = (
  asset: AnyAsset,
  thorPoolDetails?: PoolDetail[],
  mayaPoolDetails?: MayaPoolDetail[]
): number => {
  const { chain } = asset

  // Check specific token decimals before chain-level defaults
  if (isTCYAsset(asset)) {
    return THORCHAIN_DECIMAL
  }

  if (isMayaAsset(asset)) {
    return MAYA_DECIMAL
  }

  // Check hardcoded decimals for native chain assets
  const chainDecimal = CHAIN_DECIMAL_MAP.get(chain)
  if (chainDecimal !== undefined && asset.type === 0 /* AssetType.NATIVE */) {
    return chainDecimal
  }

  // Check hardcoded token decimal map (reliable, no network dependency)
  const tokenDecimal = getTokenDecimal(chain, asset.symbol)
  if (tokenDecimal !== null) {
    return tokenDecimal
  }

  // Fallback: use chain decimal for any remaining asset type on this chain
  if (chainDecimal !== undefined) {
    return chainDecimal
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

    if (mayaPoolDetail) {
      const validatedDecimal = validateAndParseDecimal(mayaPoolDetail.nativeDecimal)
      if (validatedDecimal !== null) {
        return validatedDecimal
      }
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

    if (thorPoolDetail) {
      const validatedDecimal = validateAndParseDecimal(thorPoolDetail.nativeDecimal)
      if (validatedDecimal !== null) {
        return validatedDecimal
      }
    }
  }

  // Return a sensible default - most tokens use 18 decimals
  return 18
}

export const getDecimal = (
  asset: AnyAsset,
  thorPoolDetails?: PoolDetail[],
  mayaPoolDetails?: MayaPoolDetail[]
): Promise<number> => Promise.resolve(getDecimalSync(asset, thorPoolDetails, mayaPoolDetails))

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
