import TransportNodeHidSingleton from '@ledgerhq/hw-transport-node-hid-singleton'
import { FeeOption, Network, TxHash } from '@xchainjs/xchain-client'
import { defaultEthParams } from '@xchainjs/xchain-ethereum'
import { ClientLedger, LedgerSigner } from '@xchainjs/xchain-evm'
import { ethers } from 'ethers'

import { IPCLedgerApproveERC20TokenParams } from '../../../../shared/api/io'
import { defaultArbParams } from '../../../../shared/arb/const'
import { defaultAvaxParams } from '../../../../shared/avax/const'
import { defaultBscParams } from '../../../../shared/bsc/const'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { ETH_MAINNET_ETHERS_PROVIDER, ETH_TESTNET_ETHERS_PROVIDER, createEthProviders } from '../ethereum/common'

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
  const transport = await TransportNodeHidSingleton.create()
  switch (chain) {
    case 'ETH':
      clientParams = {
        ...defaultEthParams,
        providers: {
          mainnet: new ethers.providers.EtherscanProvider('homestead', apiKey),
          testnet: ETH_TESTNET_ETHERS_PROVIDER,
          stagenet: ETH_MAINNET_ETHERS_PROVIDER
        },
        dataProviders: [createEthProviders(apiKey)],
        signer: new LedgerSigner({
          transport,
          provider: new ethers.providers.EtherscanProvider('homestead', apiKey),
          derivationPath: getDerivationPath(walletAccount, hdMode)
        }),
        rootDerivationPaths: getDerivationPaths(walletAccount, hdMode),
        network: network
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
        network: network
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
        network: network
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
        network: network
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
