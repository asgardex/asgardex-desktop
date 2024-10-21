import { AVAXChain, AVAX_DECIMAL, AVAX_GAS_ASSET_DECIMAL, AssetAVAX, UPPER_FEE_BOUND } from '@xchainjs/xchain-avax'
import { ExplorerProvider, FeeBounds, Network } from '@xchainjs/xchain-client'
import { EVMClientParams } from '@xchainjs/xchain-evm'
import { EtherscanProvider, RoutescanProvider } from '@xchainjs/xchain-evm-providers'
import { BigNumber, ethers } from 'ethers'

import { envOrDefault } from '../utils/env'

const LOWER_FEE_BOUND = 1_000_000_000

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

export const AvaxZeroAddress = '0x0000000000000000000000000000000000000000'
export const avaxscanApiKey = envOrDefault(process.env.REACT_APP_SNOWTRACE_API_KEY, '')

// =====Ethers providers=====
const AVALANCHE_MAINNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/avalanche')
const AVALANCHE_TESTNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/avalanche_fuji')

const ethersJSProviders = {
  [Network.Mainnet]: AVALANCHE_MAINNET_ETHERS_PROVIDER,
  [Network.Testnet]: AVALANCHE_TESTNET_ETHERS_PROVIDER,
  [Network.Stagenet]: AVALANCHE_MAINNET_ETHERS_PROVIDER
}
// =====Ethers providers=====
// =====ONLINE providers=====

const AVAX_ONLINE_PROVIDER_TESTNET = new EtherscanProvider(
  AVALANCHE_TESTNET_ETHERS_PROVIDER,
  'https://api-testnet.snowtrace.dev',
  avaxscanApiKey,
  AVAXChain,
  AssetAVAX,
  AVAX_DECIMAL
)
const AVAX_ONLINE_PROVIDER_MAINNET = new EtherscanProvider(
  AVALANCHE_MAINNET_ETHERS_PROVIDER,
  'https://api.snowtrace.dev',
  avaxscanApiKey,
  AVAXChain,
  AssetAVAX,
  AVAX_DECIMAL
)
const avaxProviders = {
  [Network.Mainnet]: AVAX_ONLINE_PROVIDER_MAINNET,
  [Network.Testnet]: AVAX_ONLINE_PROVIDER_TESTNET,
  [Network.Stagenet]: AVAX_ONLINE_PROVIDER_MAINNET
}
const ROUTESCAN_PROVIDER_MAINNET = new RoutescanProvider(
  AVALANCHE_MAINNET_ETHERS_PROVIDER,
  'https://api.routescan.io',
  43114,
  AssetAVAX,
  AVAX_DECIMAL
)

const ROUTESCAN_PROVIDER_TESTNET = new RoutescanProvider(
  AVALANCHE_TESTNET_ETHERS_PROVIDER,
  'https://api.routescan.io',
  43113,
  AssetAVAX,
  AVAX_DECIMAL,
  true
)

const routescanProviders = {
  [Network.Mainnet]: ROUTESCAN_PROVIDER_MAINNET,
  [Network.Testnet]: ROUTESCAN_PROVIDER_TESTNET,
  [Network.Stagenet]: ROUTESCAN_PROVIDER_MAINNET
}
// =====ONLINE providers=====

// =====Explorers=====
const AVAX_MAINNET_EXPLORER = new ExplorerProvider(
  'https://snowtrace.dev/',
  'https://snowtrace.dev/address/%%ADDRESS%%',
  'https://snowtrace.dev/tx/%%TX_ID%%'
)
const AVAX_TESTNET_EXPLORER = new ExplorerProvider(
  'https://testnet.snowtrace.dev/',
  'https://testnet.snowtrace.dev/address/%%ADDRESS%%',
  'https://testnet.snowtrace.dev/tx/%%TX_ID%%'
)
const avaxExplorerProviders = {
  [Network.Mainnet]: AVAX_MAINNET_EXPLORER,
  [Network.Testnet]: AVAX_TESTNET_EXPLORER,
  [Network.Stagenet]: AVAX_MAINNET_EXPLORER
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
    gasPrice: BigNumber.from(30)
  },
  [Network.Testnet]: {
    approveGasLimit: BigNumber.from(200000),
    transferGasAssetGasLimit: BigNumber.from(23000),
    transferTokenGasLimit: BigNumber.from(100000),
    gasPrice: BigNumber.from(30)
  },
  [Network.Stagenet]: {
    approveGasLimit: BigNumber.from(200000),
    transferGasAssetGasLimit: BigNumber.from(23000),
    transferTokenGasLimit: BigNumber.from(100000),
    gasPrice: BigNumber.from(30)
  }
}
export const defaultAvaxParams: EVMClientParams = {
  chain: AVAXChain,
  gasAsset: AssetAVAX,
  gasAssetDecimals: AVAX_GAS_ASSET_DECIMAL,
  defaults,
  providers: ethersJSProviders,
  explorerProviders: avaxExplorerProviders,
  dataProviders: [avaxProviders, routescanProviders],
  network: Network.Mainnet,
  feeBounds: {
    lower: LOWER_FEE_BOUND,
    upper: UPPER_FEE_BOUND
  },
  rootDerivationPaths: ethRootDerivationPaths
}
