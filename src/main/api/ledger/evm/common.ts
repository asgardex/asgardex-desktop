import type Transport from '@ledgerhq/hw-transport'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network, Protocol } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { ClientLedger, EVMClientParams, LedgerSigner } from '@xchainjs/xchain-evm'
import { AnyAsset, Chain } from '@xchainjs/xchain-util'
import { EtherscanProvider, JsonRpcProvider } from 'ethers'

import { isAethAsset, isAvaxAsset, isBaseAsset, isBscAsset, isEthAsset } from '../../../../renderer/helpers/assetHelper'
import { defaultArbParams } from '../../../../shared/arb/const'
import { defaultAvaxParams } from '../../../../shared/avax/const'
import { defaultBaseParams } from '../../../../shared/base/const'
import { defaultBscParams } from '../../../../shared/bsc/const'
import { defaultEthParams } from '../../../../shared/ethereum/const'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { EvmHDMode } from '../../../../shared/evm/types'
import { ETH_MAINNET_ETHERS_PROVIDER, ETH_TESTNET_ETHERS_PROVIDER, createEthProviders } from '../ethereum/common'

export const DEPOSIT_EXPIRATION_OFFSET = 15 * 60 // 15min in seconds

export type LedgerEvmChainConfig = {
  chain: Chain
  defaultParams: EVMClientParams
  chainIds: { mainnet: number; testnet: number }
  networkNames: { mainnet: string; testnet: string }
  isChainAsset: (asset: AnyAsset) => boolean
  depositGasLimit: number
  useChecksummedContractAddress: boolean // true: AVAX/BASE, false: ETH/ARB/BSC
  includeDepositTxOptions: boolean // true: ETH/ARB/BSC, false: AVAX/BASE
  depositProtocol?: Protocol // ETH uses Protocol.THORCHAIN
}

export const EVM_LEDGER_CHAINS: Partial<Record<Chain, LedgerEvmChainConfig>> = {
  [ETHChain]: {
    chain: ETHChain,
    defaultParams: defaultEthParams,
    chainIds: { mainnet: 1, testnet: 11155111 },
    networkNames: { mainnet: 'homestead', testnet: 'sepolia' },
    isChainAsset: isEthAsset,
    depositGasLimit: 160000,
    useChecksummedContractAddress: false,
    includeDepositTxOptions: true,
    depositProtocol: Protocol.THORCHAIN
  },
  [ARBChain]: {
    chain: ARBChain,
    defaultParams: defaultArbParams,
    chainIds: { mainnet: 42161, testnet: 421614 },
    networkNames: { mainnet: 'arbitrum', testnet: 'arbitrum-sepolia' },
    isChainAsset: isAethAsset,
    depositGasLimit: 160000,
    useChecksummedContractAddress: false,
    includeDepositTxOptions: true
  },
  [AVAXChain]: {
    chain: AVAXChain,
    defaultParams: defaultAvaxParams,
    chainIds: { mainnet: 43114, testnet: 43113 },
    networkNames: { mainnet: 'avalanche', testnet: 'fuji' },
    isChainAsset: isAvaxAsset,
    depositGasLimit: 160000,
    useChecksummedContractAddress: true,
    includeDepositTxOptions: false
  },
  [BSCChain]: {
    chain: BSCChain,
    defaultParams: defaultBscParams,
    chainIds: { mainnet: 56, testnet: 97 },
    networkNames: { mainnet: 'bnb', testnet: 'bnb-testnet' },
    isChainAsset: isBscAsset,
    depositGasLimit: 160000,
    useChecksummedContractAddress: false,
    includeDepositTxOptions: true
  },
  [BASEChain]: {
    chain: BASEChain,
    defaultParams: defaultBaseParams,
    chainIds: { mainnet: 8453, testnet: 84532 },
    networkNames: { mainnet: 'base', testnet: 'base-sepolia' },
    isChainAsset: isBaseAsset,
    depositGasLimit: 160000,
    useChecksummedContractAddress: true,
    includeDepositTxOptions: false
  }
}

/**
 * Resolve the JSON-RPC / Etherscan provider for a given EVM chain.
 * ETH uses 'homestead' network name and has special default provider logic.
 */
export const resolveEvmProvider = (
  config: LedgerEvmChainConfig,
  network: Network,
  evmRpcUrl?: string,
  options?: { forDeposit?: boolean; apiKey?: string }
): JsonRpcProvider | EtherscanProvider => {
  const isTestnet = network === Network.Testnet

  if (config.chain === ETHChain) {
    if (evmRpcUrl) return new JsonRpcProvider(evmRpcUrl, 'homestead')
    // ETH deposit defaults to EtherscanProvider; send defaults to llamarpc
    if (options?.forDeposit) return new EtherscanProvider('homestead', options.apiKey)
    return new JsonRpcProvider('https://eth.llamarpc.com', 'homestead')
  }

  if (evmRpcUrl) {
    const chainId = isTestnet ? config.chainIds.testnet : config.chainIds.mainnet
    const networkName = isTestnet ? config.networkNames.testnet : config.networkNames.mainnet
    return new JsonRpcProvider(evmRpcUrl, { name: networkName, chainId })
  }

  return config.defaultParams.providers[network] as JsonRpcProvider
}

/**
 * Build the full providers map for ClientLedger.
 * ETH uses static testnet/stagenet providers from ethereum/common.ts.
 * Other chains spread defaultParams.providers, overriding only the current network if RPC URL provided.
 */
export const buildProvidersMap = (
  config: LedgerEvmChainConfig,
  network: Network,
  provider: JsonRpcProvider | EtherscanProvider,
  evmRpcUrl?: string
) => {
  if (config.chain === ETHChain) {
    return {
      mainnet: provider,
      testnet: ETH_TESTNET_ETHERS_PROVIDER,
      stagenet: ETH_MAINNET_ETHERS_PROVIDER
    }
  }
  return evmRpcUrl ? { ...config.defaultParams.providers, [network]: provider } : config.defaultParams.providers
}

/**
 * Create a Ledger-backed EVM client from a chain config.
 * Handles ETH's custom data provider setup (Etherscan with API key).
 */
export const createLedgerEvmClient = ({
  config,
  transport,
  network,
  walletAccount,
  evmHDMode,
  provider,
  evmRpcUrl,
  apiKey
}: {
  config: LedgerEvmChainConfig
  transport: Transport
  network: Network
  walletAccount: number
  evmHDMode: EvmHDMode
  provider: JsonRpcProvider | EtherscanProvider
  evmRpcUrl?: string
  apiKey?: string
}): ClientLedger => {
  const providers = buildProvidersMap(config, network, provider, evmRpcUrl)

  const params = {
    ...config.defaultParams,
    providers,
    signer: new LedgerSigner({
      transport,
      provider,
      derivationPath: getDerivationPath(walletAccount, evmHDMode)
    }),
    rootDerivationPaths: getDerivationPaths(walletAccount, evmHDMode),
    network,
    // ETH needs custom data providers with the API key
    ...(config.chain === ETHChain && apiKey ? { dataProviders: [createEthProviders(apiKey)] } : {})
  }

  return new ClientLedger(params)
}
