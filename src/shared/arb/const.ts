import { ARBChain, ARB_DECIMAL, ARB_GAS_ASSET_DECIMAL, AssetAETH, LOWER_FEE_BOUND } from '@xchainjs/xchain-arbitrum'
import { ExplorerProvider, Network } from '@xchainjs/xchain-client'
import { EVMClientParams } from '@xchainjs/xchain-evm'
import { RoutescanProvider } from '@xchainjs/xchain-evm-providers'
import BigNumber from 'bignumber.js'
import { JsonRpcProvider } from 'ethers'

export const UPPER_FEE_BOUND = 2000000000

// =====JSON-RPC Providers=====
// Define providers for ARB mainnet and testnet
const ARBITRUM_MAINNET_ETHERS_PROVIDER = new JsonRpcProvider('https://arb1.arbitrum.io/rpc')
const ARBITRUM_TESTNET_ETHERS_PROVIDER = new JsonRpcProvider('https://goerli-rollup.arbitrum.io/rpc')

const ethersJSProviders = {
  [Network.Mainnet]: ARBITRUM_MAINNET_ETHERS_PROVIDER,
  [Network.Testnet]: ARBITRUM_TESTNET_ETHERS_PROVIDER,
  [Network.Stagenet]: ARBITRUM_MAINNET_ETHERS_PROVIDER
}
// =====JSON-RPC Providers=====

// =====Data Providers=====
// Define data providers (Etherscan/Routescan) for different networks

// Etherscan providers removed - Etherscan's gas oracle doesn't support Arbitrum
// This was causing "Missing Or invalid Module name" errors and wrong gas price fallbacks
const ROUTESCAN_PROVIDER_MAINNET = new RoutescanProvider(
  ARBITRUM_MAINNET_ETHERS_PROVIDER,
  'https://api.routescan.io',
  42161,
  AssetAETH,
  ARB_DECIMAL
)

const ROUTESCAN_PROVIDER_TESTNET = new RoutescanProvider(
  ARBITRUM_TESTNET_ETHERS_PROVIDER,
  'https://api.routescan.io',
  421614,
  AssetAETH,
  ARB_DECIMAL,
  true
)

const routescanProviders = {
  [Network.Mainnet]: ROUTESCAN_PROVIDER_MAINNET,
  [Network.Testnet]: ROUTESCAN_PROVIDER_TESTNET,
  [Network.Stagenet]: ROUTESCAN_PROVIDER_MAINNET
}
// =====Data Providers=====

// =====Block Explorers=====
// =====Block Explorers=====
// Define explorer providers for different networks
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
// =====Block Explorers=====

// =====Network Configuration=====
// Define root derivation paths and default parameters
const evmRootDerivationPaths = {
  [Network.Mainnet]: `m/44'/60'/0'/0/`,
  [Network.Testnet]: `m/44'/60'/0'/0/`,
  [Network.Stagenet]: `m/44'/60'/0'/0/`
}

const defaults = {
  [Network.Mainnet]: {
    approveGasLimit: new BigNumber(200000),
    transferGasAssetGasLimit: new BigNumber(23000),
    transferTokenGasLimit: new BigNumber(100000),
    gasPrice: new BigNumber(0.2 * 10 ** 9)
  },
  [Network.Testnet]: {
    approveGasLimit: new BigNumber(200000),
    transferGasAssetGasLimit: new BigNumber(23000),
    transferTokenGasLimit: new BigNumber(100000),
    gasPrice: new BigNumber(0.2 * 10 ** 9)
  },
  [Network.Stagenet]: {
    approveGasLimit: new BigNumber(200000),
    transferGasAssetGasLimit: new BigNumber(23000),
    transferTokenGasLimit: new BigNumber(100000),
    gasPrice: new BigNumber(0.2 * 10 ** 9)
  }
}

export const defaultArbParams: EVMClientParams = {
  chain: ARBChain,
  gasAsset: AssetAETH,
  gasAssetDecimals: ARB_GAS_ASSET_DECIMAL,
  defaults,
  providers: ethersJSProviders,
  explorerProviders: arbExplorerProviders,
  dataProviders: [routescanProviders],
  network: Network.Mainnet,
  feeBounds: {
    lower: LOWER_FEE_BOUND,
    upper: UPPER_FEE_BOUND
  },
  rootDerivationPaths: evmRootDerivationPaths
}
