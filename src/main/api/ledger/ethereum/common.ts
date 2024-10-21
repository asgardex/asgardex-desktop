import { FeeBounds, Network } from '@xchainjs/xchain-client'
import { AssetETH, ETHChain, ETH_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-ethereum'
import { EtherscanProvider } from '@xchainjs/xchain-evm-providers'
import { ethers } from 'ethers'

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

export const ETH_MAINNET_ETHERS_PROVIDER = new ethers.providers.EtherscanProvider('homestead', etherscanApiKey)
const network = ethers.providers.getNetwork('sepolia')
export const ETH_TESTNET_ETHERS_PROVIDER = new ethers.providers.EtherscanProvider(network)

// Helper function to create ethProviders
export const createEthProviders = (apiKey: string | undefined) => {
  const ETHERSCAN_URLS = {
    mainnet: 'https://api.etherscan.io/',
    testnet: 'https://api-sepolia.etherscan.io/'
  }

  // Create the online providers with the provided API key
  const ETH_ONLINE_PROVIDER_TESTNET = new EtherscanProvider(
    ETH_TESTNET_ETHERS_PROVIDER,
    ETHERSCAN_URLS.testnet,
    apiKey || '',
    ETHChain,
    AssetETH,
    ETH_GAS_ASSET_DECIMAL
  )

  const ETH_ONLINE_PROVIDER_MAINNET = new EtherscanProvider(
    ETH_MAINNET_ETHERS_PROVIDER,
    ETHERSCAN_URLS.mainnet,
    apiKey || '',
    ETHChain,
    AssetETH,
    ETH_GAS_ASSET_DECIMAL
  )

  // Return the providers object
  return {
    [Network.Mainnet]: ETH_ONLINE_PROVIDER_MAINNET,
    [Network.Testnet]: ETH_ONLINE_PROVIDER_TESTNET,
    [Network.Stagenet]: ETH_ONLINE_PROVIDER_MAINNET
  }
}
