import { UPPER_FEE_BOUND as BASE_UPPER_FEE_BOUND } from '@xchainjs/xchain-base'
import { FeeOption, Network, TxHash } from '@xchainjs/xchain-client'
import { defaultEthParams, UPPER_FEE_BOUND } from '@xchainjs/xchain-ethereum'
import { ClientLedger, LedgerSigner } from '@xchainjs/xchain-evm'
import { EtherscanProvider, JsonRpcProvider } from 'ethers'

import { IPCLedgerApproveERC20TokenParams } from '../../../../shared/api/io'
import { defaultArbParams } from '../../../../shared/arb/const'
import { defaultAvaxParams } from '../../../../shared/avax/const'
import { defaultBaseParams } from '../../../../shared/base/const'
import { defaultBscParams } from '../../../../shared/bsc/const'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { ETH_MAINNET_ETHERS_PROVIDER, ETH_TESTNET_ETHERS_PROVIDER, createEthProviders } from '../ethereum/common'

const TransportNodeHidSingleton = require('@ledgerhq/hw-transport-node-hid-singleton')

const LOWER_FEE_BOUND = 1000000

export const approveLedgerERC20Token = async ({
  chain,
  network,
  contractAddress,
  spenderAddress,
  walletAccount,
  walletIndex,
  hdMode,
  apiKey,
  evmRpcUrl
}: IPCLedgerApproveERC20TokenParams): Promise<TxHash> => {
  let clientParams
  const transport = await TransportNodeHidSingleton.default.create()
  const isTestnet = network === Network.Testnet

  switch (chain) {
    case 'ETH': {
      // Use custom RPC URL if provided, otherwise use EtherscanProvider
      const mainnetProvider = evmRpcUrl
        ? new JsonRpcProvider(evmRpcUrl, 'homestead')
        : new EtherscanProvider('homestead', apiKey)

      clientParams = {
        ...defaultEthParams,
        providers: {
          mainnet: mainnetProvider,
          testnet: ETH_TESTNET_ETHERS_PROVIDER,
          stagenet: ETH_MAINNET_ETHERS_PROVIDER
        },
        dataProviders: [createEthProviders(apiKey)],
        signer: new LedgerSigner({
          transport,
          provider: mainnetProvider,
          derivationPath: getDerivationPath(walletAccount, hdMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, hdMode),
        network: network,
        feeBounds: {
          lower: LOWER_FEE_BOUND,
          upper: UPPER_FEE_BOUND
        }
      }
      break
    }
    case 'ARB': {
      // Arbitrum One mainnet: 42161, Arbitrum Sepolia testnet: 421614
      const chainId = isTestnet ? 421614 : 42161
      const networkName = isTestnet ? 'arbitrum-sepolia' : 'arbitrum'

      const provider = evmRpcUrl
        ? new JsonRpcProvider(evmRpcUrl, { name: networkName, chainId })
        : defaultArbParams.providers[network]

      clientParams = {
        ...defaultArbParams,
        providers: evmRpcUrl ? { ...defaultArbParams.providers, [network]: provider } : defaultArbParams.providers,
        signer: new LedgerSigner({
          transport,
          provider,
          derivationPath: getDerivationPath(walletAccount, hdMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, hdMode),
        network: network,
        feeBounds: {
          lower: LOWER_FEE_BOUND,
          upper: UPPER_FEE_BOUND
        }
      }
      break
    }
    case 'AVAX': {
      // AVAX mainnet: 43114, Fuji testnet: 43113
      const chainId = isTestnet ? 43113 : 43114
      const networkName = isTestnet ? 'fuji' : 'avalanche'

      const provider = evmRpcUrl
        ? new JsonRpcProvider(evmRpcUrl, { name: networkName, chainId })
        : defaultAvaxParams.providers[network]

      clientParams = {
        ...defaultAvaxParams,
        providers: evmRpcUrl ? { ...defaultAvaxParams.providers, [network]: provider } : defaultAvaxParams.providers,
        signer: new LedgerSigner({
          transport,
          provider,
          derivationPath: getDerivationPath(walletAccount, hdMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, hdMode),
        network: network,
        feeBounds: {
          lower: LOWER_FEE_BOUND,
          upper: UPPER_FEE_BOUND
        }
      }
      break
    }
    case 'BSC': {
      // BSC mainnet: 56, BSC testnet: 97
      const chainId = isTestnet ? 97 : 56
      const networkName = isTestnet ? 'bnb-testnet' : 'bnb'

      const provider = evmRpcUrl
        ? new JsonRpcProvider(evmRpcUrl, { name: networkName, chainId })
        : defaultBscParams.providers[network]

      clientParams = {
        ...defaultBscParams,
        providers: evmRpcUrl ? { ...defaultBscParams.providers, [network]: provider } : defaultBscParams.providers,
        signer: new LedgerSigner({
          transport,
          provider,
          derivationPath: getDerivationPath(walletAccount, hdMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, hdMode),
        network: network,
        feeBounds: {
          lower: LOWER_FEE_BOUND,
          upper: UPPER_FEE_BOUND
        }
      }
      break
    }
    case 'BASE': {
      // Base mainnet: 8453, Base Sepolia testnet: 84532
      const chainId = isTestnet ? 84532 : 8453
      const networkName = isTestnet ? 'base-sepolia' : 'base'

      const provider = evmRpcUrl
        ? new JsonRpcProvider(evmRpcUrl, { name: networkName, chainId })
        : defaultBaseParams.providers[network]

      clientParams = {
        ...defaultBaseParams,
        providers: evmRpcUrl ? { ...defaultBaseParams.providers, [network]: provider } : defaultBaseParams.providers,
        signer: new LedgerSigner({
          transport,
          provider,
          derivationPath: getDerivationPath(walletAccount, hdMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, hdMode),
        network: network,
        feeBounds: {
          lower: LOWER_FEE_BOUND,
          upper: BASE_UPPER_FEE_BOUND
        }
      }
      break
    }
    default:
      throw new Error(`Unsupported chain: ${chain}`)
  }

  const client = new ClientLedger(clientParams)
  const transactionHash = await client.approve({
    contractAddress,
    spenderAddress,
    feeOption: FeeOption.Fast,
    walletIndex
  })

  return transactionHash
}
