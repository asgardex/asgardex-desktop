import { BASEChain, Client, BASE_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-base'
import { baseAmount } from '@xchainjs/xchain-util'

import { createBaseParams } from '../../../shared/base/const'
import { isBASEAsset, addressInBaseWhitelist } from '../../helpers/assetHelper'
import { BASEAssetsFallback } from '../../const'
import { network$ } from '../app/service'
import { baseRpc$, evmGasMultiplier$ } from '../storage/common'
import { EVMZeroAddress } from '../evm/const'
import { createEvmChainService } from '../evm/factory'

const {
  client$,
  clientState$,
  address$,
  addressUI$,
  explorerUrl$,
  reloadBalances,
  balances$,
  reloadBalances$,
  resetReloadBalances,
  getBalanceByAddress$,
  enhancedClient$,
  createTransactionService,
  createFeesService
} = createEvmChainService({
  chain: BASEChain,
  chainName: 'BASE',
  gasAssetDecimal: BASE_GAS_ASSET_DECIMAL,
  isChainAsset: isBASEAsset,
  createClientParams: createBaseParams,
  ClientClass: Client,
  rpc$: baseRpc$,
  addressInWhitelist: addressInBaseWhitelist,
  assetsFallback: BASEAssetsFallback,
  assetsTestnet: BASEAssetsFallback,
  defaultGasLimit: 200000,
  initialReloadFeesParams: { amount: baseAmount(1), recipient: EVMZeroAddress }
})

const {
  txs$,
  tx$,
  txStatus$,
  subscribeTx,
  resetTx,
  sendTx,
  txRD$,
  sendPoolTx$,
  approveERC20Token$,
  isApprovedERC20Token$
} = createTransactionService(client$, network$, baseRpc$, evmGasMultiplier$, enhancedClient$)
const { reloadFees, fees$, poolInTxFees$, approveFee$, reloadApproveFee } = createFeesService(
  enhancedClient$,
  evmGasMultiplier$
)

export {
  client$,
  clientState$,
  address$,
  addressUI$,
  reloadBalances,
  explorerUrl$,
  balances$,
  getBalanceByAddress$,
  reloadBalances$,
  resetReloadBalances,
  txs$,
  tx$,
  txStatus$,
  sendTx,
  subscribeTx,
  resetTx,
  txRD$,
  reloadFees,
  fees$,
  sendPoolTx$,
  poolInTxFees$,
  approveFee$,
  reloadApproveFee,
  approveERC20Token$,
  isApprovedERC20Token$
}
