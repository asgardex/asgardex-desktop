import { ARBChain, ARB_DECIMAL, ARB_GAS_ASSET_DECIMAL, AssetAETH, LOWER_FEE_BOUND } from '@xchainjs/xchain-arbitrum'
import { ExplorerProvider, FeeBounds, Network } from '@xchainjs/xchain-client'
import { EVMClientParams } from '@xchainjs/xchain-evm'
import { EtherscanProvider, RoutescanProvider } from '@xchainjs/xchain-evm-providers'
import { BigNumber, ethers } from 'ethers'

import { envOrDefault } from '../utils/env'

export const UPPER_FEE_BOUND = 2000000000

export const FEE_BOUNDS: Record<Network, FeeBounds | undefined> = {
  /* for main|stagenet use default values defined in ETH.Client */
  [Network.Mainnet]: undefined,
  [Network.Stagenet]: undefined,
  [Network.Testnet]: {
    lower: LOWER_FEE_BOUND,
    upper: UPPER_FEE_BOUND
  }
}
export const DEPOSIT_EXPIRATION_OFFSET = 15 * 60 // 15min in seconds

export const ArbZeroAddress = '0x0000000000000000000000000000000000000000'
export const arbscanApiKey = envOrDefault(process.env.REACT_APP_ARBISCAN_API_KEY, '')

// =====Ethers providers=====
// Define JSON-RPC providers for mainnet and testnet
const ARBITRUM_MAINNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider('https://arb1.arbitrum.io/rpc')
const ARBITRUM_TESTNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider('https://goerli-rollup.arbitrum.io/rpc')

const ethersJSProviders = {
  [Network.Mainnet]: ARBITRUM_MAINNET_ETHERS_PROVIDER,
  [Network.Testnet]: ARBITRUM_TESTNET_ETHERS_PROVIDER,
  [Network.Stagenet]: ARBITRUM_MAINNET_ETHERS_PROVIDER
}
// =====Ethers providers=====
// =====ONLINE providers=====

const ARB_ONLINE_PROVIDER_TESTNET = new EtherscanProvider(
  ARBITRUM_TESTNET_ETHERS_PROVIDER,
  'https://api-goerli.arbiscan.io',
  arbscanApiKey,
  ARBChain,
  AssetAETH,
  ARB_DECIMAL
)
const ARB_ONLINE_PROVIDER_MAINNET = new EtherscanProvider(
  ARBITRUM_MAINNET_ETHERS_PROVIDER,
  'https://api.arbiscan.io',
  arbscanApiKey,
  ARBChain,
  AssetAETH,
  ARB_DECIMAL
)
const arbProviders = {
  [Network.Mainnet]: ARB_ONLINE_PROVIDER_MAINNET,
  [Network.Testnet]: ARB_ONLINE_PROVIDER_TESTNET,
  [Network.Stagenet]: ARB_ONLINE_PROVIDER_MAINNET
}
const ROUTESCAN_PROVIDER_MAINNET = new RoutescanProvider(
  ARBITRUM_MAINNET_ETHERS_PROVIDER,
  'https://api.routescan.io',
  43114,
  AssetAETH,
  ARB_DECIMAL
)

const ROUTESCAN_PROVIDER_TESTNET = new RoutescanProvider(
  ARBITRUM_TESTNET_ETHERS_PROVIDER,
  'https://api.routescan.io',
  42161,
  AssetAETH,
  ARB_DECIMAL,
  true
)

const routescanProviders = {
  [Network.Mainnet]: ROUTESCAN_PROVIDER_MAINNET,
  [Network.Testnet]: ROUTESCAN_PROVIDER_TESTNET,
  [Network.Stagenet]: ROUTESCAN_PROVIDER_MAINNET
}
// =====ONLINE providers=====

// =====Explorers=====
// Define explorer providers for mainnet and testnet
const ARB_MAINNET_EXPLORER = new ExplorerProvider(
  'https://arbiscan.io/',
  'https://arbiscan.io/address/%%ADDRESS%%',
  'https://arbiscan.io/tx/%%TX_ID%%'
)
const ARB_TESTNET_EXPLORER = new ExplorerProvider(
  'https://goerli.arbiscan.io',
  'https://goerli.arbiscan.io/address/%%ADDRESS%%',
  'https://goerli.arbiscan.io/tx/%%TX_ID%%'
)
const arbExplorerProviders = {
  [Network.Mainnet]: ARB_MAINNET_EXPLORER,
  [Network.Testnet]: ARB_TESTNET_EXPLORER,
  [Network.Stagenet]: ARB_MAINNET_EXPLORER
}
// =====Explorers=====

const ethRootDerivationPaths = {
  [Network.Mainnet]: `m/44'/60'/0'/0/`,
  [Network.Testnet]: `m/44'/60'/0'/0/`,
  [Network.Stagenet]: `m/44'/60'/0'/0/`
}

const defaults = {
  [Network.Mainnet]: {
    approveGasLimit: BigNumber.from(200000),
    transferGasAssetGasLimit: BigNumber.from(23000),
    transferTokenGasLimit: BigNumber.from(100000),
    gasPrice: BigNumber.from(0.2 * 10 ** 9)
  },
  [Network.Testnet]: {
    approveGasLimit: BigNumber.from(200000),
    transferGasAssetGasLimit: BigNumber.from(23000),
    transferTokenGasLimit: BigNumber.from(100000),
    gasPrice: BigNumber.from(0.2 * 10 ** 9)
  },
  [Network.Stagenet]: {
    approveGasLimit: BigNumber.from(200000),
    transferGasAssetGasLimit: BigNumber.from(23000),
    transferTokenGasLimit: BigNumber.from(100000),
    gasPrice: BigNumber.from(0.2 * 10 ** 9)
  }
}

export const defaultArbParams: EVMClientParams = {
  chain: ARBChain,
  gasAsset: AssetAETH,
  gasAssetDecimals: ARB_GAS_ASSET_DECIMAL,
  defaults,
  providers: ethersJSProviders,
  explorerProviders: arbExplorerProviders,
  dataProviders: [arbProviders, routescanProviders],
  network: Network.Mainnet,
  feeBounds: {
    lower: LOWER_FEE_BOUND,
    upper: UPPER_FEE_BOUND
  },
  rootDerivationPaths: ethRootDerivationPaths
}
