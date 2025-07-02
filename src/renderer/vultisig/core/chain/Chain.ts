// When adding a new Ethereum L2 chain, add its icon to `core/ui/public/chains` as a lowercase SVG file (e.g. `arbitrum.svg`, `base.svg`)
export const EthereumL2Chain = {
  Arbitrum: 'Arbitrum',
  Base: 'Base',
  Blast: 'Blast',
  Optimism: 'Optimism',
  Zksync: 'Zksync'
} as const

export type EthereumL2Chain = typeof EthereumL2Chain[keyof typeof EthereumL2Chain]

export const EvmChain = {
  ...EthereumL2Chain,
  Avalanche: 'Avalanche',
  CronosChain: 'CronosChain',
  BSC: 'BSC',
  Ethereum: 'Ethereum',
  Polygon: 'Polygon'
} as const

export type EvmChain = typeof EvmChain[keyof typeof EvmChain]

export enum UtxoChain {
  Bitcoin = 'Bitcoin',
  BitcoinCash = 'Bitcoin-Cash',
  Litecoin = 'Litecoin',
  Dogecoin = 'Dogecoin',
  Dash = 'Dash',
  Zcash = 'Zcash'
}

export const IbcEnabledCosmosChain = {
  Cosmos: 'Cosmos',
  Osmosis: 'Osmosis',
  Dydx: 'Dydx',
  Kujira: 'Kujira',
  Terra: 'Terra',
  TerraClassic: 'TerraClassic',
  Noble: 'Noble',
  Akash: 'Akash'
} as const

export type IbcEnabledCosmosChain = typeof IbcEnabledCosmosChain[keyof typeof IbcEnabledCosmosChain]

const VaultBasedCosmosChain = {
  THORChain: 'THORChain',
  MayaChain: 'MayaChain'
} as const

type VaultBasedCosmosChain = typeof VaultBasedCosmosChain[keyof typeof VaultBasedCosmosChain]

export const CosmosChain = {
  ...IbcEnabledCosmosChain,
  ...VaultBasedCosmosChain
} as const

export type CosmosChain = typeof CosmosChain[keyof typeof CosmosChain]

export enum OtherChain {
  Sui = 'Sui',
  Solana = 'Solana',
  Polkadot = 'Polkadot',
  Ton = 'Ton',
  Ripple = 'Ripple',
  Tron = 'Tron'
}

export const Chain = {
  ...EvmChain,
  ...UtxoChain,
  ...CosmosChain,
  ...OtherChain
} as const

export type Chain = typeof Chain[keyof typeof Chain]
