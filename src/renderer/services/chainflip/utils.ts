import { Asset as CAsset, AssetData, Chain as CChain, Chains } from '@chainflip/sdk/swap'
import { TRONChain } from '@xchainjs/xchain-tron'
import {
  AnyAsset,
  Asset as XAsset,
  AssetType,
  assetToString,
  Chain as XChain,
  TokenAsset as XTokenAsset
} from '@xchainjs/xchain-util'

import { BSCChain } from '../../../shared/utils/chainIds'

// Warn once per chain. Chainflip can add a chain before this map does; throwing here
// runs inside render (wallet asset table, swap view) and blanks the window.
const warnedChains = new Set<string>()

/** Test helper: forget which unmapped chains have been logged */
export const resetUnsupportedChainWarnings = () => warnedChains.clear()

const warnUnsupportedChain = (chain: string) => {
  if (warnedChains.has(chain)) return
  warnedChains.add(chain)
  // `console.warn` on purpose, not `helpers/logger`: the logger is silent outside dev builds.
  // eslint-disable-next-line no-console
  console.warn(`[ASGARDEX][Chainflip] chain "${chain}" is not mapped to an xchainjs chain and was skipped`)
}

export const cChainToXChain = (chain: CChain): XChain | null => {
  switch (chain) {
    case 'Bitcoin':
      return 'BTC'
    case 'Ethereum':
      return 'ETH'
    case 'Arbitrum':
      return 'ARB'
    case 'Solana':
      return 'SOL'
    case 'Tron':
      return TRONChain
    case 'Bsc':
      return BSCChain
    case 'Assethub':
      return null // Assethub is not supported in XChainJS, return null instead of throwing
    default:
      // Never throw here: the asset list comes from the live Chainflip API and
      // callers run inside React render (useMemo), so throwing blanks the wallet.
      warnUnsupportedChain(chain)
      return null
  }
}

export const xChainToCChain = (chain: XChain): CChain => {
  switch (chain) {
    case 'BTC':
      return Chains.Bitcoin
    case 'ETH':
      return Chains.Ethereum
    case 'ARB':
      return Chains.Arbitrum
    case 'SOL':
      return Chains.Solana
    case TRONChain:
      return Chains.Tron
    case BSCChain:
      return Chains.Bsc
    default:
      throw Error('Unsupported chain in Chainflip')
  }
}

export const isChainflipSupportedChain = (chain: XChain): boolean => {
  try {
    xChainToCChain(chain)
    return true
  } catch {
    return false
  }
}

// Asset-level Chainflip support check. Compares full asset identity (chain +
// symbol incl. contract address) against the supplied Chainflip asset list so
// unsupported ERC20/SPL tokens on Chainflip-supported chains are rejected.
export const isChainflipSupportedAsset = (asset: AnyAsset, chainflipAssets: ReadonlyArray<AnyAsset>): boolean => {
  const target = assetToString(asset)
  return chainflipAssets.some((a) => assetToString(a) === target)
}

export const cAssetToXAsset = (asset: AssetData): XAsset | XTokenAsset | null => {
  const chain = cChainToXChain(asset.chain)
  if (!chain) return null
  return {
    chain,
    symbol: asset.contractAddress ? `${asset.symbol}-${asset.contractAddress}` : asset.symbol,
    ticker: asset.symbol,
    type: asset.contractAddress ? AssetType.TOKEN : AssetType.NATIVE
  }
}

export const xAssetToCAsset = (asset: XAsset | XTokenAsset): CAsset => {
  return asset.ticker as CAsset
}

/** One `groupedAggregates` bucket of Chainflip's reporting API, keyed by its `groupBy` field */
export type ChainflipVolumeAggregate = { keys: [string]; sum: { ingressValueUsd: string | null } }

export type ChainflipVolumeResponse = {
  data?: {
    bySource?: { groupedAggregates: ChainflipVolumeAggregate[] }
    byDestination?: { groupedAggregates: ChainflipVolumeAggregate[] }
  }
  errors?: { message: string }[]
}

/**
 * Sums `ingressValueUsd` per Chainflip asset key (e.g. `Btc`, `ArbUsdc`) across both the source and
 * destination side of a swap, so an asset's volume counts a swap whether it was bought or sold.
 *
 * Keys are `AssetData.chainflipId`, not the ticker on `AssetData.asset` (`BTC`, `USDC`).
 */
export const sumVolumeByAsset = (response: ChainflipVolumeResponse): Map<string, number> => {
  const volumeByAsset = new Map<string, number>()
  const add = (aggregates: ChainflipVolumeAggregate[] = []) => {
    for (const { keys, sum } of aggregates) {
      const usd = Number(sum.ingressValueUsd ?? 0)
      if (!isFinite(usd)) continue
      const [asset] = keys
      volumeByAsset.set(asset, (volumeByAsset.get(asset) ?? 0) + usd)
    }
  }
  add(response.data?.bySource?.groupedAggregates)
  add(response.data?.byDestination?.groupedAggregates)
  return volumeByAsset
}

/** 24h USD volume for one asset. A ticker lookup collides (`USDC` is both `Usdc` and `ArbUsdc`) and misses. */
export const chainflipAssetVolumeUsd = (
  volumeByAsset: ReadonlyMap<string, number>,
  asset: Pick<AssetData, 'chainflipId'>
): number | undefined => volumeByAsset.get(asset.chainflipId)
