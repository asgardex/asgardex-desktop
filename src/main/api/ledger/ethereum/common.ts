import { Network } from '@xchainjs/xchain-client'
import { AssetETH, ETHChain, ETH_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-ethereum'
import { EtherscanProviderV2 } from '@xchainjs/xchain-evm-providers'
import { ethers } from 'ethers'

export const DEFAULT_APPROVE_GAS_LIMIT_FALLBACK = '65000'

export const DEPOSIT_EXPIRATION_OFFSET = 15 * 60 // 15min in seconds

export const ETHAddress = '0x0000000000000000000000000000000000000000'

export const ETH_MAINNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider('https://eth.llamarpc.com', 'homestead')
const network = ethers.providers.getNetwork('sepolia')
export const ETH_TESTNET_ETHERS_PROVIDER = new ethers.providers.JsonRpcProvider(
  'https://ethereum-sepolia-rpc.publicnode.com',
  network
)

// Helper function to create ethProviders
export const createEthProviders = (apiKey: string | undefined) => {
  const ETHERSCAN_URLS = {
    mainnet: 'https://api.etherscan.io/v2',
    testnet: 'https://api.etherscan.io/v2'
  }

  // Create the online providers with the provided API key
  const ETH_ONLINE_PROVIDER_TESTNET = new EtherscanProviderV2(
    ETH_TESTNET_ETHERS_PROVIDER,
    ETHERSCAN_URLS.testnet,
    apiKey || '',
    ETHChain,
    AssetETH,
    ETH_GAS_ASSET_DECIMAL,
    11155111
  )

  const ETH_ONLINE_PROVIDER_MAINNET = new EtherscanProviderV2(
    ETH_MAINNET_ETHERS_PROVIDER,
    ETHERSCAN_URLS.mainnet,
    apiKey || '',
    ETHChain,
    AssetETH,
    ETH_GAS_ASSET_DECIMAL,
    1
  )

  // Return the providers object
  return {
    [Network.Mainnet]: ETH_ONLINE_PROVIDER_MAINNET,
    [Network.Testnet]: ETH_ONLINE_PROVIDER_TESTNET,
    [Network.Stagenet]: ETH_ONLINE_PROVIDER_MAINNET
  }
}
