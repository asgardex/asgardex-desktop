import { Chain, CosmosChain, EvmChain, OtherChain, UtxoChain } from './Chain'

const chainKindRecord = {
  [EvmChain.Arbitrum]: 'evm',
  [EvmChain.Avalanche]: 'evm',
  [EvmChain.Base]: 'evm',
  [EvmChain.CronosChain]: 'evm',
  [EvmChain.BSC]: 'evm',
  [EvmChain.Blast]: 'evm',
  [EvmChain.Ethereum]: 'evm',
  [EvmChain.Optimism]: 'evm',
  [EvmChain.Polygon]: 'evm',
  [EvmChain.Zksync]: 'evm',

  [UtxoChain.Bitcoin]: 'utxo',
  [UtxoChain.BitcoinCash]: 'utxo',
  [UtxoChain.Litecoin]: 'utxo',
  [UtxoChain.Dogecoin]: 'utxo',
  [UtxoChain.Dash]: 'utxo',
  [UtxoChain.Zcash]: 'utxo',
  [CosmosChain.THORChain]: 'cosmos',
  [CosmosChain.Cosmos]: 'cosmos',
  [CosmosChain.Osmosis]: 'cosmos',
  [CosmosChain.MayaChain]: 'cosmos',
  [CosmosChain.Dydx]: 'cosmos',
  [CosmosChain.Kujira]: 'cosmos',
  [CosmosChain.Terra]: 'cosmos',
  [CosmosChain.TerraClassic]: 'cosmos',
  [CosmosChain.Noble]: 'cosmos',
  [CosmosChain.Akash]: 'cosmos',

  [OtherChain.Sui]: 'sui',
  [OtherChain.Solana]: 'solana',
  [OtherChain.Polkadot]: 'polkadot',
  [OtherChain.Ton]: 'ton',
  [OtherChain.Ripple]: 'ripple',
  [OtherChain.Tron]: 'tron'
} as const

export type ChainKind = typeof chainKindRecord[Chain]

export type DeriveChainKind<T> = T extends Chain ? typeof chainKindRecord[T] : never

export function getChainKind<T extends Chain>(chain: T): DeriveChainKind<T> {
  return chainKindRecord[chain] as DeriveChainKind<T>
}

export type ChainsOfKind<K extends ChainKind> = {
  [C in Chain]: typeof chainKindRecord[C] extends K ? C : never
}[Chain]
