import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { AnyAsset, AssetType } from '@xchainjs/xchain-util'

type Assets = 'ETH' | 'BTC' | 'DOGE' | 'USDT'

type AssetsMainnet = Record<Assets, AnyAsset>

export const ASSETS_MAINNET: AssetsMainnet = {
  ETH: { chain: ETHChain, symbol: 'ETH', ticker: 'ETH', type: AssetType.NATIVE },
  BTC: { chain: BTCChain, symbol: 'BTC', ticker: 'BTC', type: AssetType.NATIVE },
  DOGE: { chain: DOGEChain, symbol: 'DOGE', ticker: 'DOGE', type: AssetType.NATIVE },
  USDT: {
    chain: BSCChain,
    symbol: 'BSC.USDT-0x55d398326f99059fF775485246999027B3197955',
    ticker: 'USDT',
    type: AssetType.TOKEN
  }
}

type ERCAssets = 'USDT'

export const ERC20_MAINNET: Record<ERCAssets, AnyAsset> = {
  USDT: {
    chain: ETHChain,
    symbol: 'USDT-0xdac17f958d2ee523a2206206994597c13d831ec7',
    ticker: 'USDT',
    type: AssetType.TOKEN
  }
}

export const ERC20_TESTNET: Record<ERCAssets, AnyAsset> = {
  USDT: {
    chain: ETHChain,
    symbol: 'USDT-0xdb99328b43b86037f80b43c3dbd203f00f056b75',
    ticker: 'USDT',
    type: AssetType.TOKEN
  }
}
