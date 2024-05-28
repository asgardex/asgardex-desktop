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
  walletIndex,
  hdMode
}: IPCLedgerApproveERC20TokenParams): Promise<TxHash> => {
  let clientParams

  switch (chain) {
    case 'ETH':
      clientParams = {
        ...defaultEthParams,
        network: network,
        rootDerivationPaths: getDerivationPaths(walletIndex, hdMode)
      }
      break
    case 'ARB':
      clientParams = {
        ...defaultArbParams,
        network: network,
        rootDerivationPaths: getDerivationPaths(walletIndex, hdMode)
      }
      break
    case 'AVAX':
      clientParams = {
        ...defaultAvaxParams,
        network: network,
        rootDerivationPaths: getDerivationPaths(walletIndex, hdMode)
      }
      break
    case 'BSC':
      clientParams = {
        ...defaultBscParams,
        network: network,
        rootDerivationPaths: getDerivationPaths(walletIndex, hdMode)
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
