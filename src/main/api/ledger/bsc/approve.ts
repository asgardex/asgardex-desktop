import EthApp from '@ledgerhq/hw-app-eth'
import TransportNodeHidSingleton from '@ledgerhq/hw-transport-node-hid-singleton'
import * as BSC from '@xchainjs/xchain-bsc'
import { FeeOption, TxHash } from '@xchainjs/xchain-client'

import { IPCLedgerApproveERC20TokenParams } from '../../../../shared/api/io'
import { FEE_BOUNDS, defaultBscParams } from '../../../../shared/bsc/const'
import { getDerivationPath } from '../../../../shared/evm/ledger'
import { toClientNetwork } from '../../../../shared/utils/client'
import { LedgerSigner } from '../ethereum/LedgerSigner'

export const approveLedgerERC20Token = async ({
  network,
  contractAddress,
  spenderAddress,
  walletIndex,
  evmHdMode
}: IPCLedgerApproveERC20TokenParams): Promise<TxHash> => {
  const clientNetwork = toClientNetwork(network)

  const client = new BSC.Client({ ...defaultBscParams, network: clientNetwork, feeBounds: FEE_BOUNDS[clientNetwork] })

  const transport = await TransportNodeHidSingleton.open()
  const app = new EthApp(transport)
  const path = getDerivationPath(walletIndex, evmHdMode)
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
