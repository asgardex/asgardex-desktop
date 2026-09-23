import { FeeOption, TxHash } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { ClientLedger, LedgerSigner } from '@xchainjs/xchain-evm'
import { baseAmount } from '@xchainjs/xchain-util'

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
  evmRpcUrl,
  amount
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

  // Omit amount → unlimited; "0" → revoke; finite base-unit string → limited approve.
  // Decimal is unused by getApprovalAmount (reads amount().toFixed() only), so 0 is fine.
  const approveAmount = amount !== undefined ? baseAmount(amount, 0) : undefined

  return client.approve({
    contractAddress,
    spenderAddress,
    feeOption: FeeOption.Fast,
    walletIndex,
    ...(approveAmount !== undefined ? { amount: approveAmount } : {})
  })
}
