import EthApp from '@ledgerhq/hw-app-eth'
import TransportNodeHidSingleton from '@ledgerhq/hw-transport-node-hid-singleton'
import * as AVAX from '@xchainjs/xchain-avax'
import * as BSC from '@xchainjs/xchain-bsc'
import { FeeOption, TxHash } from '@xchainjs/xchain-client'
import * as ETH from '@xchainjs/xchain-ethereum'
import { Client as XchainEvmClient } from '@xchainjs/xchain-evm'

import { IPCLedgerApproveERC20TokenParams } from '../../../../shared/api/io'
import { defaultAvaxParams } from '../../../../shared/avax/const'
import { defaultBscParams } from '../../../../shared/bsc/const'
import { FEE_BOUNDS, defaultEthParams } from '../../../../shared/ethereum/const'
import { getDerivationPath } from '../../../../shared/evm/ledger'
import { toClientNetwork } from '../../../../shared/utils/client'
import { LedgerSigner } from '../ethereum/LedgerSigner'

export const approveLedgerERC20Token = async ({
  chain,
  network,
  contractAddress,
  spenderAddress,
  walletIndex,
  evmHdMode
}: IPCLedgerApproveERC20TokenParams): Promise<TxHash> => {
  const clientNetwork = toClientNetwork(network)
  const path = getDerivationPath(walletIndex, evmHdMode)
  let client: XchainEvmClient

  switch (chain) {
    case 'ETH':
      client = new ETH.Client({
        ...defaultEthParams,
        network: clientNetwork,
        feeBounds: FEE_BOUNDS[clientNetwork]
      })
      break
    case 'AVAX':
      client = new AVAX.Client({ ...defaultAvaxParams, network: clientNetwork, feeBounds: FEE_BOUNDS[clientNetwork] })
      break
    case 'BSC':
      client = new BSC.Client({ ...defaultBscParams, network: clientNetwork, feeBounds: FEE_BOUNDS[clientNetwork] })
      break
    default:
      client = new ETH.Client({ ...defaultEthParams, network: clientNetwork, feeBounds: FEE_BOUNDS[clientNetwork] })
      break
  }

  const transport = await TransportNodeHidSingleton.create()
  const app = new EthApp(transport)

  const provider = client.getProvider()
  const signer = new LedgerSigner({ provider, path, app })

  const { wait } = await client.approve({
    signer,
    contractAddress,
    spenderAddress,
    feeOption: FeeOption.Fast // ChainTxFeeOption.APPROVE
  })

  // wait until the transaction has been mined
  const { transactionHash } = await wait(1)

  await transport.close()

  return transactionHash
}
