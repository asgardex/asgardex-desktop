import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { Asset } from '@xchainjs/xchain-util'

type Assets = 'ETH' | 'BTC' | 'DOGE' | 'USDT'

type AssetsMainnet = Record<Assets, Asset>

export const ASSETS_MAINNET: AssetsMainnet = {
  ETH: { chain: ETHChain, symbol: 'ETH', ticker: 'ETH', synth: false },
  BTC: { chain: BTCChain, symbol: 'BTC', ticker: 'BTC', synth: false },
  DOGE: { chain: DOGEChain, symbol: 'DOGE', ticker: 'DOGE', synth: false },
  USDT: { chain: BSCChain, symbol: 'BSC.USDT-0X55D398326F99059FF775485246999027B319795', ticker: 'USDT', synth: false }
}

type ERCAssets = 'USDT'

export const ERC20_MAINNET: Record<ERCAssets, Asset> = {
  USDT: { chain: ETHChain, symbol: 'USDT-0xdac17f958d2ee523a2206206994597c13d831ec7', ticker: 'USDT', synth: false }
}

export const ERC20_TESTNET: Record<ERCAssets, Asset> = {
  USDT: { chain: ETHChain, symbol: 'USDT-0xdb99328b43b86037f80b43c3dbd203f00f056b75', ticker: 'USDT', synth: false }
}
