import { AssetType, type Asset, type Chain } from '@xchainjs/xchain-util'

/**
 * In-app chain id. Matches `RadixChain` in `@xchainjs/xchain-radix` (`'XRD'`).
 * Kept here so the startup graph does not import that package: its entry pulls
 * the Radix Engine Toolkit wasm.
 */
export const RadixChain: Chain = 'XRD'

/** Matches `XRD_DECIMAL` in `@xchainjs/xchain-radix` (18). */
export const XRD_DECIMAL = 18

export const AssetXRD: Asset = {
  chain: RadixChain,
  symbol: 'XRD',
  ticker: 'XRD',
  type: AssetType.NATIVE
}

/** MayaChain delisted Radix. Native send stays; swap and liquidity do not. */
export const radixTradeDisabled = (chain: Chain): boolean => chain === RadixChain
