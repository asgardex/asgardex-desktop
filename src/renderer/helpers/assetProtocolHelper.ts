import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import { AnyAsset, AssetType, isSecuredAsset, isSynthAsset } from '@xchainjs/xchain-util'

import { isChainOfMaya, isChainOfThor } from '../../shared/utils/chain'
import { isCacaoAsset, isRuneNativeAsset } from './assetHelper'

/**
 * Gets the protocols that can handle both assets in a swap
 */
export const getRequiredProtocolsForAssets = (
  sourceAsset: AnyAsset,
  targetAsset: AnyAsset,
  chainflipAssetCheck?: (asset: AnyAsset) => boolean
): Protocol[] => {
  // Get protocols that can handle the source asset
  const sourceProtocols = getSupportedProtocolsForAsset(sourceAsset, chainflipAssetCheck)
  // Get protocols that can handle the target asset
  const targetProtocols = getSupportedProtocolsForAsset(targetAsset, chainflipAssetCheck)

  // Find intersection - protocols that can handle BOTH assets
  const intersection = sourceProtocols.filter((protocol) => targetProtocols.includes(protocol))

  // Return only protocols that can handle both assets (may be empty)
  return intersection
}

/**
 * Gets protocols that can support a single asset
 */
const getSupportedProtocolsForAsset = (
  asset: AnyAsset,
  chainflipAssetCheck?: (asset: AnyAsset) => boolean
): Protocol[] => {
  const supportedProtocols: Set<Protocol> = new Set()

  // THORChain protocol can handle:
  if (
    asset.type === AssetType.TRADE || // Trade assets (THORChain specific)
    isSecuredAsset(asset) || // Secured assets (THORChain specific)
    isRuneNativeAsset(asset) || // RUNE native
    isChainOfThor(asset.chain) // Chains supported by THOR
  ) {
    supportedProtocols.add('Thorchain')
  }

  // MAYAChain protocol can handle:
  if (
    isSynthAsset(asset) || // Synth assets (MAYAChain specific)
    isCacaoAsset(asset) || // CACAO native
    isChainOfMaya(asset.chain) // Chains supported by MAYA
  ) {
    supportedProtocols.add('Mayachain')
  }

  // Chainflip protocol can handle assets based on dynamic check or fallback to hardcoded
  if (chainflipAssetCheck) {
    if (chainflipAssetCheck(asset)) {
      supportedProtocols.add('Chainflip')
    }
  } else {
    // Fallback to hardcoded values if no dynamic check provided
    const chainflipSupportedChains = ['BTC', 'ETH', 'DOT']
    const chainflipSupportedAssets = ['USDC', 'USDT', 'FLIP']

    if (
      chainflipSupportedChains.includes(asset.chain) ||
      chainflipSupportedAssets.includes(asset.symbol.toUpperCase())
    ) {
      supportedProtocols.add('Chainflip')
    }
  }

  // If no protocols detected, return empty array so upstream code can handle the error
  if (supportedProtocols.size === 0) {
    return []
  }

  return Array.from(supportedProtocols)
}

/**
 * Validates if enabled protocols can handle the given asset pair
 */
export const validateProtocolsForAssets = (
  sourceAsset: AnyAsset,
  targetAsset: AnyAsset,
  enabledProtocols: Protocol[],
  chainflipAssetCheck?: (asset: AnyAsset) => boolean
): {
  isValid: boolean
  missingProtocols: Protocol[]
  requiredProtocols: Protocol[]
} => {
  const requiredProtocols = getRequiredProtocolsForAssets(sourceAsset, targetAsset, chainflipAssetCheck)

  // If no protocols can handle both assets, the pair is invalid
  if (requiredProtocols.length === 0) {
    return {
      isValid: false,
      missingProtocols: [],
      requiredProtocols
    }
  }

  // Check if AT LEAST ONE required protocol is enabled
  const hasValidProtocol = requiredProtocols.some((protocol) => enabledProtocols.includes(protocol))

  // Missing protocols are all the required ones that aren't enabled
  const missingProtocols = requiredProtocols.filter((protocol) => !enabledProtocols.includes(protocol))

  return {
    isValid: hasValidProtocol,
    missingProtocols,
    requiredProtocols
  }
}

/**
 * Creates a human-readable error message for missing protocols
 */
export const createProtocolErrorMessage = (
  sourceAsset: AnyAsset,
  targetAsset: AnyAsset,
  missingProtocols: Protocol[],
  chainflipAssetCheck?: (asset: AnyAsset) => boolean
): string => {
  const assetPairText = `${sourceAsset.symbol} to ${targetAsset.symbol}`

  if (missingProtocols.length === 0) {
    return ''
  }

  if (missingProtocols.length === 1) {
    const protocol = missingProtocols[0]
    return `Enable ${protocol} protocol to swap ${assetPairText}`
  }

  // For multiple protocols, user needs to enable at least one that can handle both assets
  const requiredProtocols = getRequiredProtocolsForAssets(sourceAsset, targetAsset, chainflipAssetCheck)
  const availableProtocols = missingProtocols.filter((protocol) => requiredProtocols.includes(protocol))

  if (availableProtocols.length === 1) {
    return `Enable ${availableProtocols[0]} protocol to swap ${assetPairText}`
  }

  if (availableProtocols.length === 2) {
    return `Enable ${availableProtocols[0]} or ${availableProtocols[1]} protocol to swap ${assetPairText}`
  }

  // For 3 or more protocols - user needs to enable at least one
  if (availableProtocols.length > 2) {
    const lastProtocol = availableProtocols[availableProtocols.length - 1]
    const otherProtocols = availableProtocols.slice(0, -1).join(', ')
    return `Enable one of these protocols to swap ${assetPairText}: ${otherProtocols}, or ${lastProtocol}`
  }

  // Fallback
  return `Enable a compatible protocol to swap ${assetPairText}`
}
