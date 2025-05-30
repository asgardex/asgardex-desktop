import { AssetBSC, BSCChain, BSC_GAS_ASSET_DECIMAL, UPPER_FEE_BOUND } from '@xchainjs/xchain-bsc'
import { ExplorerProvider, Network } from '@xchainjs/xchain-client'
import { EVMClientParams } from '@xchainjs/xchain-evm'
import { EtherscanProviderV2 } from '@xchainjs/xchain-evm-providers'
import { BigNumber, ethers } from 'ethers'

import { etherscanApiKey } from '../api/etherscan'
import { envOrDefault } from '../utils/env'

const LOWER_FEE_BOUND = 1000000

export const ankrApiKey = envOrDefault(import.meta.env.VITE_ANKR_API_KEY, '')
// =====Ethers providers=====
const BSC_MAINNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider(`https://rpc.ankr.com/bsc/${ankrApiKey}`)
const BSC_TESTNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider(
  `https://rpc.ankr.com/bsc_testnet_chapel/${ankrApiKey}`
)

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
