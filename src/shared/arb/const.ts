import {
  ARBChain,
  ARB_DECIMAL,
  ARB_GAS_ASSET_DECIMAL,
  AssetARB,
  LOWER_FEE_BOUND,
  UPPER_FEE_BOUND
} from '@xchainjs/xchain-arbitrum'
import { ExplorerProvider, FeeBounds, Network } from '@xchainjs/xchain-client'
import { EVMClientParams } from '@xchainjs/xchain-evm'
import { EtherscanProvider, RoutescanProvider } from '@xchainjs/xchain-evm-providers'
import { BigNumber, ethers } from 'ethers'

import { envOrDefault } from '../utils/env'

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

// =====Ethers providers=====
const ARBITRUM_MAINNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/arbitrum')
const ARBITRUM_TESTNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/arbitrum_sepolia')

const ethersJSProviders = {
  [Network.Mainnet]: ARBITRUM_MAINNET_ETHERS_PROVIDER,
  [Network.Testnet]: ARBITRUM_TESTNET_ETHERS_PROVIDER,
  [Network.Stagenet]: ARBITRUM_MAINNET_ETHERS_PROVIDER
}
// =====Ethers providers=====
// =====ONLINE providers=====

const ARB_ONLINE_PROVIDER_TESTNET = new EtherscanProvider(
  ARBITRUM_TESTNET_ETHERS_PROVIDER,
  'https://api-sepolia.arbiscan.io',
  envOrDefault(process.env.REACT_APP_ARBISCAN_API_KEY, ''),
  ARBChain,
  AssetARB,
  ARB_DECIMAL
)
const ARB_ONLINE_PROVIDER_MAINNET = new EtherscanProvider(
  ARBITRUM_MAINNET_ETHERS_PROVIDER,
  'https://api.arbiscan.io',
  envOrDefault(process.env.REACT_APP_ARBISCAN_API_KEY, ''),
  ARBChain,
  AssetARB,
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
  AssetARB,
  ARB_DECIMAL
)

const ROUTESCAN_PROVIDER_TESTNET = new RoutescanProvider(
  ARBITRUM_TESTNET_ETHERS_PROVIDER,
  'https://api.routescan.io',
  42161,
  AssetARB,
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
const ARB_MAINNET_EXPLORER = new ExplorerProvider(
  'https://arbiscan.io/',
  'https://arbiscan.io/address/%%ADDRESS%%',
  'https://arbiscan.io/tx/%%TX_ID%%'
)
const ARB_TESTNET_EXPLORER = new ExplorerProvider(
  'https://sepolia.arbiscan.io/',
  'https://sepolia.arbiscan.io/address/%%ADDRESS%%',
  'https://sepolia.arbiscan.io/tx/%%TX_ID%%'
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
export const defaultArbParams: EVMClientParams = {
  chain: ARBChain,
  gasAsset: AssetARB,
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
