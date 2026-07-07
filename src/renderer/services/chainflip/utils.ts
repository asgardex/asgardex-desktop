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
    case 'Assethub':
      return null // Assethub is not supported in XChainJS, return null instead of throwing
    default:
      throw Error('Unsupported chain in XChainJS')
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
