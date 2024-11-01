// Import necessary modules and classes from external packages and files
import { BASEChain, LOWER_FEE_BOUND, UPPER_FEE_BOUND, BASE_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-base'
import { ExplorerProvider, FeeBounds, Network } from '@xchainjs/xchain-client'
import { EVMClientParams } from '@xchainjs/xchain-evm'
import { EtherscanProvider } from '@xchainjs/xchain-evm-providers'
import { Asset, AssetType } from '@xchainjs/xchain-util'
import { BigNumber, ethers } from 'ethers'

import { envOrDefault } from '../utils/env'

// Define constants related to Base
export const FEE_BOUNDS: Record<Network, FeeBounds | undefined> = {
  /* for main|stagenet use default values defined in ETH.Client */
  [Network.Mainnet]: undefined,
  [Network.Stagenet]: undefined,
  [Network.Testnet]: {
    lower: LOWER_FEE_BOUND,
    upper: UPPER_FEE_BOUND
  }
}
// BASE ETH Gas asset
export const AssetBETH: Asset = { chain: BASEChain, symbol: 'ETH', ticker: 'ETH', type: AssetType.NATIVE }

export const baseScanApiKey = envOrDefault(process.env.REACT_APP_BASE_API_KEY, '')

// Define JSON-RPC providers for mainnet and testnet
const BASE_MAINNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider('https://1rpc.io/base')
const BASE_TESTNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider('https://base-sepolia-rpc.publicnode.com')

// Define ethers providers for different networks
const ethersJSProviders = {
  [Network.Mainnet]: BASE_MAINNET_ETHERS_PROVIDER,
  [Network.Testnet]: BASE_TESTNET_ETHERS_PROVIDER,
  [Network.Stagenet]: BASE_MAINNET_ETHERS_PROVIDER
}

// Define online providers (Etherscan) for mainnet and testnet
const BASE_ONLINE_PROVIDER_MAINNET = new EtherscanProvider(
  BASE_MAINNET_ETHERS_PROVIDER,
  'https://api.basescan.org',
  baseScanApiKey || '',
  BASEChain,
  AssetBETH,
  18
)

const BASE_ONLINE_PROVIDER_TESTNET = new EtherscanProvider(
  BASE_TESTNET_ETHERS_PROVIDER,
  'https://api-sepolia.basescan.org',
  baseScanApiKey || '',
  BASEChain,
  AssetBETH,
  18
)

// Define providers for different networks
const baseProviders = {
  [Network.Mainnet]: BASE_ONLINE_PROVIDER_MAINNET,
  [Network.Testnet]: BASE_ONLINE_PROVIDER_TESTNET,
  [Network.Stagenet]: BASE_ONLINE_PROVIDER_MAINNET
}

// Define explorer providers for mainnet and testnet
const BASE_MAINNET_EXPLORER = new ExplorerProvider(
  'https://basescan.org/',
  'https://basescan.org/address/%%ADDRESS%%',
  'https://basescan.org/tx/%%TX_ID%%'
)

const BASE_TESTNET_EXPLORER = new ExplorerProvider(
  'https://sepolia.basescan.org',
  'https://sepolia.basescan.org/address/%%ADDRESS%%',
  'https://sepolia.basescan.org/tx/%%TX_ID%%'
)

// Define explorer providers for different networks
const baseExplorerProviders = {
  [Network.Mainnet]: BASE_MAINNET_EXPLORER,
  [Network.Testnet]: BASE_TESTNET_EXPLORER,
  [Network.Stagenet]: BASE_MAINNET_EXPLORER
}

// Define root derivation paths for different networks
const ethRootDerivationPaths = {
  [Network.Mainnet]: `m/44'/60'/0'/0/`,
  [Network.Testnet]: `m/44'/60'/0'/0/`,
  [Network.Stagenet]: `m/44'/60'/0'/0/`
}

// Define default parameters for the Base client
// TODO: not sure
const defaults = {
  [Network.Mainnet]: {
    approveGasLimit: BigNumber.from(200000),
    transferGasAssetGasLimit: BigNumber.from(23000),
    transferTokenGasLimit: BigNumber.from(100000),
    gasPrice: BigNumber.from(0.03 * 10 ** 9)
  },
  [Network.Testnet]: {
    approveGasLimit: BigNumber.from(200000),
    transferGasAssetGasLimit: BigNumber.from(23000),
    transferTokenGasLimit: BigNumber.from(100000),
    gasPrice: BigNumber.from(0.03 * 10 ** 9)
  },
  [Network.Stagenet]: {
    approveGasLimit: BigNumber.from(200000),
    transferGasAssetGasLimit: BigNumber.from(23000),
    transferTokenGasLimit: BigNumber.from(100000),
    gasPrice: BigNumber.from(0.2 * 10 ** 9)
  }
}

// Define the default parameters for the Base client
export const defaultBaseParams: EVMClientParams = {
  chain: BASEChain,
  gasAsset: AssetBETH,
  gasAssetDecimals: BASE_GAS_ASSET_DECIMAL,
  defaults,
  providers: ethersJSProviders,
  explorerProviders: baseExplorerProviders,
  dataProviders: [baseProviders],
  network: Network.Mainnet,
  feeBounds: {
    lower: LOWER_FEE_BOUND,
    upper: UPPER_FEE_BOUND
  },
  rootDerivationPaths: ethRootDerivationPaths
}
