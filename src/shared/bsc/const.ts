import { AssetBSC, BSCChain, BSC_GAS_ASSET_DECIMAL, UPPER_FEE_BOUND } from '@xchainjs/xchain-bsc'
import { ExplorerProvider, Network } from '@xchainjs/xchain-client'
import { EVMClientParams } from '@xchainjs/xchain-evm'
import { EtherscanProviderV2 } from '@xchainjs/xchain-evm-providers'
import BigNumber from 'bignumber.js'
import { JsonRpcProvider } from 'ethers'

import { etherscanApiKey } from '../api/etherscan'

const LOWER_FEE_BOUND = 1000000

// =====Ethers providers=====
const BSC_MAINNET_ETHERS_PROVIDER = new JsonRpcProvider(`https://bsc-dataseed.binance.org/`)
const BSC_TESTNET_ETHERS_PROVIDER = new JsonRpcProvider(`https://data-seed-prebsc-1-s1.binance.org:8545/`)

const ethersJSProviders = {
  [Network.Mainnet]: BSC_MAINNET_ETHERS_PROVIDER,
  [Network.Testnet]: BSC_TESTNET_ETHERS_PROVIDER,
  [Network.Stagenet]: BSC_MAINNET_ETHERS_PROVIDER
}
// =====Ethers providers=====

// =====ONLINE providers=====
const BSC_ONLINE_PROVIDER_TESTNET = new EtherscanProviderV2(
  BSC_TESTNET_ETHERS_PROVIDER,
  'https://api.etherscan.io/v2',
  etherscanApiKey,
  BSCChain,
  AssetBSC,
  BSC_GAS_ASSET_DECIMAL,
  97
)
const BSC_ONLINE_PROVIDER_MAINNET = new EtherscanProviderV2(
  BSC_MAINNET_ETHERS_PROVIDER,
  'https://api.etherscan.io/v2',
  etherscanApiKey,
  BSCChain,
  AssetBSC,
  BSC_GAS_ASSET_DECIMAL,
  56
)
const bscProviders = {
  [Network.Mainnet]: BSC_ONLINE_PROVIDER_MAINNET,
  [Network.Testnet]: BSC_ONLINE_PROVIDER_TESTNET,
  [Network.Stagenet]: BSC_ONLINE_PROVIDER_MAINNET
}
// =====ONLINE providers=====

// =====Explorers=====
const BSC_MAINNET_EXPLORER = new ExplorerProvider(
  'https://bscscan.com/',
  'https://bscscan.com/address/%%ADDRESS%%',
  'https://bscscan.com/tx/%%TX_ID%%'
)
const BSC_TESTNET_EXPLORER = new ExplorerProvider(
  'https://testnet.bscscan.com/',
  'https://testnet.bscscan.com/address/%%ADDRESS%%',
  'https://testnet.bscscan.com/tx/%%TX_ID%%'
)
const bscExplorerProviders = {
  [Network.Mainnet]: BSC_MAINNET_EXPLORER,
  [Network.Testnet]: BSC_TESTNET_EXPLORER,
  [Network.Stagenet]: BSC_MAINNET_EXPLORER
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

export const defaultBscParams: EVMClientParams = {
  chain: BSCChain,
  gasAsset: AssetBSC,
  gasAssetDecimals: BSC_GAS_ASSET_DECIMAL,
  defaults,
  providers: ethersJSProviders,
  explorerProviders: bscExplorerProviders,
  dataProviders: [bscProviders],
  network: Network.Mainnet,
  feeBounds: {
    lower: LOWER_FEE_BOUND,
    upper: UPPER_FEE_BOUND
  },
  rootDerivationPaths: ethRootDerivationPaths
}
