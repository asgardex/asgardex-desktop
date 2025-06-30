import { UPPER_FEE_BOUND as BASE_UPPER_FEE_BOUND } from '@xchainjs/xchain-base'
import { FeeOption, Network, TxHash } from '@xchainjs/xchain-client'
import { defaultEthParams, UPPER_FEE_BOUND } from '@xchainjs/xchain-ethereum'
import { ClientLedger, LedgerSigner } from '@xchainjs/xchain-evm'
import { EtherscanProvider } from 'ethers'

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
  apiKey
}: IPCLedgerApproveERC20TokenParams): Promise<TxHash> => {
  let clientParams
  const transport = await TransportNodeHidSingleton.default.create()
  switch (chain) {
    case 'ETH':
      clientParams = {
        ...defaultEthParams,
        providers: {
          mainnet: new EtherscanProvider('homestead', apiKey),
          testnet: ETH_TESTNET_ETHERS_PROVIDER,
          stagenet: ETH_MAINNET_ETHERS_PROVIDER
        },
        dataProviders: [createEthProviders(apiKey)],
        signer: new LedgerSigner({
          transport,
          provider: new EtherscanProvider('homestead', apiKey),
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
    case 'ARB':
      clientParams = {
        ...defaultArbParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultArbParams.providers[Network.Mainnet],
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
    case 'AVAX':
      clientParams = {
        ...defaultAvaxParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultAvaxParams.providers[Network.Mainnet],
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
    case 'BSC':
      clientParams = {
        ...defaultBscParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultBscParams.providers[Network.Mainnet],
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
    case 'BASE':
      clientParams = {
        ...defaultBaseParams,
        signer: new LedgerSigner({
          transport,
          provider: defaultBaseParams.providers[Network.Mainnet],
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
