import { Asset as CAsset, AssetData, Chain as CChain, Chains } from '@chainflip/sdk/swap'
import { Asset as XAsset, AssetType, Chain as XChain, TokenAsset as XTokenAsset } from '@xchainjs/xchain-util'

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
    default:
      throw Error('Unsupported chain in Chainflip')
  }
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
