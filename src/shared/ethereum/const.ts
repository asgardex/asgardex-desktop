import { Network, ExplorerProvider } from '@xchainjs/xchain-client'
import { AssetETH, ETHChain, ETH_GAS_ASSET_DECIMAL, UPPER_FEE_BOUND } from '@xchainjs/xchain-ethereum'
import { EVMClientParams } from '@xchainjs/xchain-evm'
import { EtherscanProviderV2 } from '@xchainjs/xchain-evm-providers'
import BigNumber from 'bignumber.js'
import { JsonRpcProvider, Network as EthersNetwork } from 'ethers'

import { etherscanApiKey } from '../api/etherscan'

export const DEFAULT_APPROVE_GAS_LIMIT_FALLBACK = '65000'

const LOWER_FEE_BOUND = 1000000

const ETH_MAINNET_ETHERS_PROVIDER = new JsonRpcProvider('https://eth.llamarpc.com', 'homestead')
const network = EthersNetwork.from('sepolia')
const ETH_TESTNET_ETHERS_PROVIDER = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com', network)

const ethersJSProviders = {
  [Network.Mainnet]: ETH_MAINNET_ETHERS_PROVIDER,
  [Network.Testnet]: ETH_TESTNET_ETHERS_PROVIDER,
  [Network.Stagenet]: ETH_MAINNET_ETHERS_PROVIDER
}
// =====Ethers providers=====

// =====ONLINE providers=====
const ETH_ONLINE_PROVIDER_TESTNET = new EtherscanProviderV2(
  ETH_TESTNET_ETHERS_PROVIDER,
  'https://api.etherscan.io/v2',
  etherscanApiKey,
  ETHChain,
  AssetETH,
  ETH_GAS_ASSET_DECIMAL,
  11155111
)

const ETH_ONLINE_PROVIDER_MAINNET = new EtherscanProviderV2(
  ETH_MAINNET_ETHERS_PROVIDER,
  'https://api.etherscan.io/v2',
  etherscanApiKey,
  ETHChain,
  AssetETH,
  ETH_GAS_ASSET_DECIMAL,
  1
)
const ethProviders = {
  [Network.Mainnet]: ETH_ONLINE_PROVIDER_MAINNET,
  [Network.Testnet]: ETH_ONLINE_PROVIDER_TESTNET,
  [Network.Stagenet]: ETH_ONLINE_PROVIDER_MAINNET
}
// =====ONLINE providers=====

// =====Explorers=====
const ETH_MAINNET_EXPLORER = new ExplorerProvider(
  'https://etherscan.io',
  'https://etherscan.io/address/%%ADDRESS%%',
  'https://etherscan.io/tx/%%TX_ID%%'
)
const ETH_TESTNET_EXPLORER = new ExplorerProvider(
  'https://sepolia.etherscan.io/',
  'https://sepolia.etherscan.io/address/%%ADDRESS%%',
  'https://sepolia.etherscan.io/tx/%%TX_ID%%'
)
const ethExplorerProviders = {
  [Network.Mainnet]: ETH_MAINNET_EXPLORER,
  [Network.Testnet]: ETH_TESTNET_EXPLORER,
  [Network.Stagenet]: ETH_MAINNET_EXPLORER
}
// =====Explorers=====

const ethRootDerivationPaths = {
  [Network.Mainnet]: "m/44'/60'/0'/0/",
  [Network.Testnet]: "m/44'/60'/0'/0/",
  [Network.Stagenet]: "m/44'/60'/0'/0/"
}

const defaults = {
  [Network.Mainnet]: {
    approveGasLimit: new BigNumber(200000),
    transferGasAssetGasLimit: new BigNumber(23000),
    transferTokenGasLimit: new BigNumber(100000),
    gasPrice: new BigNumber(30 * 10 ** 9)
  },
  [Network.Testnet]: {
    approveGasLimit: new BigNumber(200000),
    transferGasAssetGasLimit: new BigNumber(23000),
    transferTokenGasLimit: new BigNumber(100000),
    gasPrice: new BigNumber(30 * 10 ** 9)
  },
  [Network.Stagenet]: {
    approveGasLimit: new BigNumber(200000),
    transferGasAssetGasLimit: new BigNumber(23000),
    transferTokenGasLimit: new BigNumber(100000),
    gasPrice: new BigNumber(30 * 10 ** 9)
  }
}

export const defaultEthParams: EVMClientParams = {
  chain: ETHChain,
  gasAsset: AssetETH,
  gasAssetDecimals: ETH_GAS_ASSET_DECIMAL,
  defaults,
  providers: ethersJSProviders,
  explorerProviders: ethExplorerProviders,
  dataProviders: [ethProviders],
  network: Network.Mainnet,
  feeBounds: {
    lower: LOWER_FEE_BOUND,
    upper: UPPER_FEE_BOUND
  },
  rootDerivationPaths: ethRootDerivationPaths
}
