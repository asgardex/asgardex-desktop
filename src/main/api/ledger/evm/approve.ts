import { FeeOption, TxHash } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { ClientLedger, LedgerSigner } from '@xchainjs/xchain-evm'

import { IPCLedgerApproveERC20TokenParams } from '../../../../shared/api/io'
import { getDerivationPath, getDerivationPaths } from '../../../../shared/evm/ledger'
import { createEthProviders } from '../ethereum/common'
import { EVM_LEDGER_CHAINS, buildProvidersMap, resolveEvmProvider } from './common'

const TransportNodeHidSingleton = require('@ledgerhq/hw-transport-node-hid-singleton')

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
  const config = EVM_LEDGER_CHAINS[chain]
  if (!config) {
    throw new Error(`Unsupported chain: ${chain}`)
  }

  const transport = await TransportNodeHidSingleton.default.create()
  const provider = resolveEvmProvider(config, network, evmRpcUrl)
  const providers = buildProvidersMap(config, network, provider, evmRpcUrl)

  const client = new ClientLedger({
    ...config.defaultParams,
    providers,
    signer: new LedgerSigner({
      transport,
      provider,
      derivationPath: getDerivationPath(walletAccount, hdMode)
    }),
    rootDerivationPaths: getDerivationPaths(walletAccount, hdMode),
    network,
    ...(config.chain === ETHChain && apiKey ? { dataProviders: [createEthProviders(apiKey)] } : {})
  })

  return client.approve({
    contractAddress,
    spenderAddress,
    feeOption: FeeOption.Fast,
    walletIndex
  })
}
