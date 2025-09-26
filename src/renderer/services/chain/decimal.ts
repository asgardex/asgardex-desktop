import * as RD from '@devexperts/remote-data-ts'
import { ARB_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-arbitrum'
import { BTC_DECIMAL } from '@xchainjs/xchain-bitcoin'
import { BCH_DECIMAL } from '@xchainjs/xchain-bitcoincash'
import { BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { ADA_DECIMALS } from '@xchainjs/xchain-cardano'
import { DASH_DECIMAL } from '@xchainjs/xchain-dash'
import { CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { PoolDetail as MayaPoolDetail } from '@xchainjs/xchain-mayamidgard'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { XRD_DECIMAL } from '@xchainjs/xchain-radix'
import { SOL_DECIMALS } from '@xchainjs/xchain-solana'
import { isTCYAsset } from '@xchainjs/xchain-thorchain'
import { TRX_DECIMAL } from '@xchainjs/xchain-tron'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import { ZEC_DECIMAL } from '@xchainjs/xchain-zcash'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isMayaSupportedAsset, isTCSupportedAsset } from '../../../shared/utils/asset'
import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { KUJI_DECIMAL } from '../kuji/const'
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
  ['ARB', ARB_GAS_ASSET_DECIMAL],
  ['BSC', BSC_GAS_ASSET_DECIMAL],
  ['THOR', THORCHAIN_DECIMAL],
  ['MAYA', CACAO_DECIMAL],
  ['DASH', DASH_DECIMAL],
  ['KUJI', KUJI_DECIMAL],
  ['XRD', XRD_DECIMAL],
  ['BTC', BTC_DECIMAL],
  ['BCH', BCH_DECIMAL],
  ['SOL', SOL_DECIMALS],
  ['TRON', TRX_DECIMAL],
  ['ZEC', ZEC_DECIMAL],
  ['ADA', ADA_DECIMALS]
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

export const getDecimal = (
  asset: AnyAsset,
  thorPoolDetails?: PoolDetail[],
  mayaPoolDetails?: MayaPoolDetail[]
): Promise<number> => {
  const { chain } = asset

  // Check hardcoded decimals first for native chain assets
  const chainDecimal = CHAIN_DECIMAL_MAP.get(chain)
  if (chainDecimal !== undefined) {
    return Promise.resolve(chainDecimal)
  }

  if (isTCYAsset(asset)) {
    return Promise.resolve(THORCHAIN_DECIMAL)
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
        return Promise.resolve(validatedDecimal)
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
        return Promise.resolve(validatedDecimal)
      }
    }
  }

  // Return a sensible default - most tokens use 18 decimals
  return Promise.resolve(18)
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
