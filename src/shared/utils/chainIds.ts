import { AnyAsset, Asset, AssetType, TokenAsset, assetAmount, assetToBase, assetToString } from '@xchainjs/xchain-util'

/**
 * Chain id strings copied locally.
 * `@xchainjs/xchain-*` publishes one entry, so importing `BTCChain` or `RadixChain`
 * also evaluates the client (Radix wasm, tiny-secp256k1 asm.js). These values are stable.
 */
export const ARBChain = 'ARB'
export const AVAXChain = 'AVAX'
export const BASEChain = 'BASE'
export const BCHChain = 'BCH'
export const BSCChain = 'BSC'
export const BTCChain = 'BTC'
export const ADAChain = 'ADA'
export const GAIAChain = 'GAIA'
export const DASHChain = 'DASH'
export const DOGEChain = 'DOGE'
export const ETHChain = 'ETH'
export const LTCChain = 'LTC'
export const MAYAChain = 'MAYA'
export const NEARChain = 'NEAR'
export const RadixChain = 'XRD'
/** Same string as `RadixChain`. `chain.ts` uses this name as the map key. */
export const RADIXChain = RadixChain
export const XRPChain = 'XRP'
export const SOLChain = 'SOL'
export const SUIChain = 'SUI'
export const THORChain = 'THOR'
export const TRONChain = 'TRON'
export const ZECChain = 'ZEC'

export const BTC_DECIMAL = 8
export const DASH_DECIMAL = 8
export const XRD_DECIMAL = 18
export const ZEC_DECIMAL = 8
export const RUNE_DECIMAL = 8
export const CACAO_DECIMAL = 10
export const MAYA_DECIMAL = 4
export const COSMOS_DECIMAL = 6

/** THORChain `MsgDeposit` ante. The package builds this with `assetToBase(assetAmount(0.02, 8))`. */
export const DEFAULT_FEE = assetToBase(assetAmount(0.02, RUNE_DECIMAL))

/** Package fee caps (`UPPER_FEE_BOUND`). The bitcoin service uses its own 2000 cap. */
export const UPPER_FEE_BOUNDBTC = 1000
export const UPPER_FEE_BOUNDDASH = 500
export const UPPER_FEE_BOUNDZEC = 100000
export const UPPER_FEE_BOUNDDOGE = 20000000
export const UPPER_FEE_BOUNDLTC = 500

export const AssetBTC: Asset = {
  chain: BTCChain,
  symbol: 'BTC',
  ticker: 'BTC',
  type: AssetType.NATIVE
}

export const AssetDASH: Asset = {
  chain: DASHChain,
  symbol: 'DASH',
  ticker: 'DASH',
  type: AssetType.NATIVE
}

export const AssetXRD: Asset = {
  chain: RadixChain,
  symbol: 'XRD',
  ticker: 'XRD',
  type: AssetType.NATIVE
}

export const AssetZEC: Asset = {
  chain: ZECChain,
  symbol: 'ZEC',
  ticker: 'ZEC',
  type: AssetType.NATIVE
}

export const AssetDOGE: Asset = {
  chain: DOGEChain,
  symbol: 'DOGE',
  ticker: 'DOGE',
  type: AssetType.NATIVE
}

export const AssetLTC: Asset = {
  chain: LTCChain,
  symbol: 'LTC',
  ticker: 'LTC',
  type: AssetType.NATIVE
}

export const AssetRuneNative: Asset = {
  chain: THORChain,
  symbol: 'RUNE',
  ticker: 'RUNE',
  type: AssetType.NATIVE
}

export const AssetTCY: TokenAsset = {
  chain: THORChain,
  symbol: 'TCY',
  ticker: 'TCY',
  type: AssetType.TOKEN
}

export const AssetCacao: Asset = {
  chain: MAYAChain,
  symbol: 'CACAO',
  ticker: 'CACAO',
  type: AssetType.NATIVE
}

export const AssetMaya: TokenAsset = {
  chain: MAYAChain,
  symbol: 'MAYA',
  ticker: 'MAYA',
  type: AssetType.TOKEN
}

export const AssetATOM: Asset = {
  chain: GAIAChain,
  symbol: 'ATOM',
  ticker: 'ATOM',
  type: AssetType.NATIVE
}

export const isTCYAsset = (asset: AnyAsset): boolean => assetToString(asset) === assetToString(AssetTCY)
