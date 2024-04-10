import { BSCChain } from '@xchainjs/xchain-bsc'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { Asset } from '@xchainjs/xchain-util'

type Assets = 'FTM' | 'TOMO' | 'BOLT' | 'USDT'

type AssetsTestnet = Record<Assets, Asset>
type AssetsMainnet = Record<Assets, Asset>

export const ASSETS_TESTNET: AssetsTestnet = {
  FTM: { chain: BSCChain, symbol: 'FTM-585', ticker: 'FTM', synth: false },
  TOMO: { chain: BSCChain, symbol: 'TOMOB-1E1', ticker: 'TOMOB', synth: false },
  BOLT: { chain: BSCChain, symbol: 'BOLT-E42', ticker: 'BOLT', synth: false },
  USDT: { chain: BSCChain, symbol: 'USDT-DC8', ticker: 'USDT', synth: false }
}

export const ASSETS_MAINNET: AssetsMainnet = {
  FTM: { chain: BSCChain, symbol: 'FTM-A64', ticker: 'FTM', synth: false },
  TOMO: { chain: BSCChain, symbol: 'TOMOB-4BC', ticker: 'TOMOB', synth: false },
  BOLT: { chain: BSCChain, symbol: 'BOLT-4C6', ticker: 'BOLT', synth: false },
  USDT: { chain: BSCChain, symbol: 'USDT-6D8', ticker: 'USDT', synth: false }
}

type ERCAssets = 'USDT'

export const ERC20_MAINNET: Record<ERCAssets, Asset> = {
  USDT: { chain: ETHChain, symbol: 'USDT-0xdac17f958d2ee523a2206206994597c13d831ec7', ticker: 'USDT', synth: false }
}

export const ERC20_TESTNET: Record<ERCAssets, Asset> = {
  USDT: { chain: ETHChain, symbol: 'USDT-0xdb99328b43b86037f80b43c3dbd203f00f056b75', ticker: 'USDT', synth: false }
}
