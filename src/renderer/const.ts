import { AVAXChain, AssetAVAX } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { AssetBSC, BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { assetAmount, bn, Asset, assetToString, baseAmount, Chain } from '@xchainjs/xchain-util'

import { AssetBTC, AssetETH, AssetRuneNative } from '../shared/utils/asset'
import { EnabledChain } from '../shared/utils/chain'
import { WalletType } from '../shared/wallet/types'
import { GetPoolsPeriodEnum as GetPoolsPeriodEnumMaya } from './services/mayaMigard/types'
import { GetPoolsPeriodEnum } from './services/midgard/types'
import { PricePoolCurrencyWeights, PricePoolAssets, PoolData } from './views/pools/Pools.types'

//
// ERC-20 assets
//

// ETH.USDT
export const AssetUSDTERC20: Asset = {
  chain: ETHChain,
  symbol: 'USDT-0xdAC17F958D2ee523a2206206994597C13D831ec7',
  ticker: 'USDT',
  synth: false
}

// ETH.USDT - testnet only
export const AssetUSDTERC20Testnet: Asset = {
  chain: ETHChain,
  symbol: 'USDT-0xa3910454bf2cb59b8b3a401589a3bacc5ca42306',
  ticker: 'USDT',
  synth: false
}

export const AssetXRuneAddress = '0x69fa0fee221ad11012bab0fdb45d444d3d2ce71c'
const AssetXRuneSymbol = 'XRUNE'
export const AssetXRune: Asset = {
  chain: ETHChain,
  symbol: `${AssetXRuneSymbol}-${AssetXRuneAddress}`,
  ticker: AssetXRuneSymbol,
  synth: false
}

export const AssetXRuneTestnet: Asset = {
  chain: ETHChain,
  symbol: 'XRUNE-0x8626db1a4f9f3e1002eeb9a4f3c6d391436ffc23',
  ticker: 'XRUNE',
  synth: false
}

export const AssetTGTERC20: Asset = {
  chain: ETHChain,
  symbol: 'TGT-0x108a850856db3f85d0269a2693d896b394c80325',
  ticker: 'TGT',
  synth: false
}

// This hardcode list is for testnet only
export const ETHAssetsTestnet = [AssetETH]
export const AvaxAssetsTestnet = [AssetAVAX]
export const BscAssetsTestnet = [AssetBSC]

// UNIH (exploit contract)
// https://etherscan.io/address/0x4bf5dc91E2555449293D7824028Eb8Fe5879B689
export const AssetUniHAddress = '0x4bf5dc91E2555449293D7824028Eb8Fe5879B689'
const AssetUniHSymbol = 'UNIH'
export const AssetUniH: Asset = {
  chain: ETHChain,
  symbol: `${AssetUniHSymbol}-${AssetUniHAddress}`,
  ticker: AssetUniHSymbol,
  synth: false
}

//
// All of following assets are needed for pricing USD
//

// ETH.USDT mainnet
export const AssetUSDTDAC: Asset = {
  chain: ETHChain,
  symbol: 'USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
  ticker: 'USDT',
  synth: false
}
// ETH.USDT testnet
export const AssetUSDT62E: Asset = {
  chain: ETHChain,
  symbol: 'USDT-0x62e273709Da575835C7f6aEf4A31140Ca5b1D190',
  ticker: 'USDT',
  synth: false
}
// ETH.USDC mainnet
export const AssetUSDC: Asset = {
  chain: ETHChain,
  symbol: 'USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
  ticker: 'USDC',
  synth: false
}

// AVAX.USDT mainnet
export const AssetUSDCAVAX: Asset = {
  chain: AVAXChain,
  symbol: 'USDC-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7',
  ticker: 'USDT',
  synth: false
}

// AVAX.USDC mainnet
export const AssetUSDTAVAX: Asset = {
  chain: AVAXChain,
  symbol: 'USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',
  ticker: 'USDC',
  synth: false
}

// BSC.USDT mainnet
export const AssetUSDTBSC: Asset = {
  chain: BSCChain,
  symbol: 'USDC-0X55D398326F99059FF775485246999027B3197955',
  ticker: 'USDT',
  synth: false
}

// BSC.USDC mainnet
export const AssetUSDCBSC: Asset = {
  chain: BSCChain,
  symbol: 'USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D',
  ticker: 'USDC',
  synth: false
}

export const DEFAULT_PRICE_ASSETS: PricePoolAssets = [AssetRuneNative, AssetETH, AssetBTC, AssetCacao]

// Weight of chains
// Needed for ordering chain related things (wallets, balances etc.)
// The higher the value the higher the weight
export const CHAIN_WEIGHTS_THOR: Record<EnabledChain, number> = {
  [THORChain]: 0,
  [MAYAChain]: 1,
  [BTCChain]: 2,
  [ETHChain]: 3,
  [BSCChain]: 4,
  [BCHChain]: 5,
  [LTCChain]: 6,
  [AVAXChain]: 7,
  [DOGEChain]: 8,
  [GAIAChain]: 9,
  [DASHChain]: 10,
  [KUJIChain]: 11
}

// Weight of chains
// Needed for ordering chain related things (wallets, balances etc.)
// The higher the value the higher the weight
export const CHAIN_WEIGHTS_MAYA: Record<EnabledChain, number> = {
  [MAYAChain]: 0,
  [THORChain]: 1,
  [BTCChain]: 2,
  [ETHChain]: 3,
  [DASHChain]: 4,
  [KUJIChain]: 5,
  [BSCChain]: 6,
  [BCHChain]: 7,
  [LTCChain]: 8,
  [AVAXChain]: 9,
  [DOGEChain]: 10,
  [GAIAChain]: 11
}
// All Mainnet Pools except AssetUSDT62E
export const USD_PRICE_ASSETS: PricePoolAssets = [
  AssetUSDTDAC, // ETH.DAI
  AssetUSDT62E, // ETH.USDT (Testnet)
  AssetUSDTERC20, // ETH.USDT
  AssetUSDTAVAX, // ETH.USDT
  AssetUSDC, // ETH.USDC
  AssetUSDCAVAX, // AVAX.USDC
  AssetUSDTBSC, // BSC.USDT
  AssetUSDCBSC // BSC.USDC
]

// Weight of currencies needed for pricing
// The higher the value the higher the weight
export const CURRENCY_WEIGHTS: PricePoolCurrencyWeights = {
  [assetToString(AssetUSDC)]: 0,
  [assetToString(AssetUSDTERC20)]: 2,
  [assetToString(AssetUSDTDAC)]: 3,
  [assetToString(AssetUSDTAVAX)]: 4,
  [assetToString(AssetUSDTAVAX)]: 5,
  [assetToString(AssetUSDTBSC)]: 6,
  [assetToString(AssetUSDCBSC)]: 7,
  [assetToString(AssetETH)]: 8,
  [assetToString(AssetBTC)]: 9,
  [assetToString(AssetRuneNative)]: 10
}

// Whitelist of pools for pricing things
export const PRICE_POOLS_WHITELIST: PricePoolAssets = [...DEFAULT_PRICE_ASSETS, ...USD_PRICE_ASSETS]

export const ZERO_BN = bn(0)

export const ONE_BN = bn(1)

export const ZERO_ASSET_AMOUNT = assetAmount(ZERO_BN)

export const ZERO_BASE_AMOUNT = baseAmount(ZERO_BN)

export const ZERO_POOL_DATA: PoolData = { runeBalance: ZERO_BASE_AMOUNT, assetBalance: ZERO_BASE_AMOUNT }

export const RECOVERY_TOOL_URL: Record<Network, string> = {
  testnet: 'https://testnet.thorswap.finance/pending',
  stagenet: 'https://stagenet.thorswap.finance/pending',
  mainnet: 'https://app.thorswap.finance/pending'
}

export const ASYM_DEPOSIT_TOOL_URL: Record<Network, string> = {
  testnet: 'https://testnet.thorswap.finance/',
  stagenet: 'https://stagenet.thorswap.finance/',
  mainnet: 'https://app.thorswap.finance/'
}

// @asgdx-team: Extend list whenever another ledger app will be supported
export const SUPPORTED_LEDGER_APPS: Chain[] = [THORChain, BTCChain, LTCChain, DOGEChain, BCHChain, ETHChain, GAIAChain]

export const DEFAULT_GET_POOLS_PERIOD = GetPoolsPeriodEnum._30d
export const DEFAULT_GET_POOLS_PERIOD_MAYA = GetPoolsPeriodEnumMaya._30d

export const DEFAULT_WALLET_TYPE: WalletType = 'keystore'
