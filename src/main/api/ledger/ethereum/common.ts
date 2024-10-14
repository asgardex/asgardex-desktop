import { FeeBounds, Network, ExplorerProvider } from '@xchainjs/xchain-client'
import { AssetETH, ETHChain, ETH_GAS_ASSET_DECIMAL, LOWER_FEE_BOUND, UPPER_FEE_BOUND } from '@xchainjs/xchain-ethereum'
import { EVMClientParams } from '@xchainjs/xchain-evm'
import { EtherscanProvider } from '@xchainjs/xchain-evm-providers'
import { BigNumber, ethers } from 'ethers'

import { etherscanApiKey } from '../../../../shared/api/etherscan'

export const DEFAULT_APPROVE_GAS_LIMIT_FALLBACK = '65000'

export const FEE_BOUNDS: Record<Network, FeeBounds | undefined> = {
  /* for main|stagenet use default values defined in ETH.Client */
  [Network.Mainnet]: undefined,
  [Network.Stagenet]: undefined,
  [Network.Testnet]: {
    lower: 1,
    upper: 150_000_000_000_000_0000 // 1.5 ETH (in case testnet gas fees are going to be crazy)
  }
}

export const DEPOSIT_EXPIRATION_OFFSET = 15 * 60 // 15min in seconds

export const ETHAddress = '0x0000000000000000000000000000000000000000'

const ETH_MAINNET_ETHERS_PROVIDER = new ethers.providers.EtherscanProvider('homestead', etherscanApiKey)
const network = ethers.providers.getNetwork('sepolia')
const ETH_TESTNET_ETHERS_PROVIDER = new ethers.providers.EtherscanProvider(network)

const ethersJSProviders = {
  [Network.Mainnet]: ETH_MAINNET_ETHERS_PROVIDER,
  [Network.Testnet]: ETH_TESTNET_ETHERS_PROVIDER,
  [Network.Stagenet]: ETH_MAINNET_ETHERS_PROVIDER
}
// =====Ethers providers=====

// =====ONLINE providers=====
const ETH_ONLINE_PROVIDER_TESTNET = new EtherscanProvider(
  ETH_TESTNET_ETHERS_PROVIDER,
  'https://api-sepolia.etherscan.io/',
  etherscanApiKey,
  ETHChain,
  AssetETH,
  ETH_GAS_ASSET_DECIMAL
)

const ETH_ONLINE_PROVIDER_MAINNET = new EtherscanProvider(
  ETH_MAINNET_ETHERS_PROVIDER,
  'https://api.etherscan.io/',
  etherscanApiKey,
  ETHChain,
  AssetETH,
  ETH_GAS_ASSET_DECIMAL
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

export const defaultEthParams: EVMClientParams = {
  chain: ETHChain,
  gasAsset: AssetETH,
  gasAssetDecimals: ETH_GAS_ASSET_DECIMAL,
  defaults,
  providers: ethersJSProviders,
  explorerProviders: ethExplorerProviders,
  dataProviders: [ethProviders],
  network: Network.Testnet,
  feeBounds: {
    lower: LOWER_FEE_BOUND,
    upper: UPPER_FEE_BOUND
  },
  rootDerivationPaths: ethRootDerivationPaths
}
