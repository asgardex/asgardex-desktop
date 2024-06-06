import TransportNodeHidSingleton from '@ledgerhq/hw-transport-node-hid-singleton'
import { FeeOption, TxHash } from '@xchainjs/xchain-client'
import { ClientLedger } from '@xchainjs/xchain-evm'

import { IPCLedgerApproveERC20TokenParams } from '../../../../shared/api/io'
import { defaultArbParams } from '../../../../shared/arb/const'
import { defaultAvaxParams } from '../../../../shared/avax/const'
import { defaultBscParams } from '../../../../shared/bsc/const'
import { defaultEthParams } from '../../../../shared/ethereum/const'
import { getDerivationPaths } from '../../../../shared/evm/ledger'

export const approveLedgerERC20Token = async ({
  chain,
  network,
  contractAddress,
  spenderAddress,
  walletAccount,
  walletIndex,
  hdMode
}: IPCLedgerApproveERC20TokenParams): Promise<TxHash> => {
  let clientParams

  const transport = await TransportNodeHidSingleton.create()
  switch (chain) {
    case 'ETH':
      clientParams = {
        transport,
        ...defaultEthParams,
        rootDerivationPaths: getDerivationPaths(walletAccount, walletIndex, hdMode),
        network: network
      }
      break
    case 'ARB':
      clientParams = {
        transport,
        ...defaultArbParams,
        rootDerivationPaths: getDerivationPaths(walletAccount, walletIndex, hdMode),
        network: network
      }
      break
    case 'AVAX':
      clientParams = {
        transport,
        ...defaultAvaxParams,
        rootDerivationPaths: getDerivationPaths(walletAccount, walletIndex, hdMode),
        network: network
      }
      break
    case 'BSC':
      clientParams = {
        transport,
        ...defaultBscParams,
        rootDerivationPaths: getDerivationPaths(walletAccount, walletIndex, hdMode),
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

  await transport.close()

  return transactionHash
}
