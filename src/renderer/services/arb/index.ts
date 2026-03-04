import { ARBChain, Client, ARB_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-arbitrum'
import { baseAmount } from '@xchainjs/xchain-util'

import { createArbParams } from '../../../shared/arb/const'
import { isAethAsset, addressInArbWhitelist } from '../../helpers/assetHelper'
import { ARBAssetsFallback, ArbAssetsTestnet } from '../../const'
import { network$ } from '../app/service'
import { arbRpc$, evmGasMultiplier$ } from '../storage/common'
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
  chain: ARBChain,
  chainName: 'ARB',
  gasAssetDecimal: ARB_GAS_ASSET_DECIMAL,
  isChainAsset: isAethAsset,
  createClientParams: createArbParams,
  ClientClass: Client,
  rpc$: arbRpc$,
  addressInWhitelist: addressInArbWhitelist,
  assetsFallback: ARBAssetsFallback,
  assetsTestnet: ArbAssetsTestnet,
  defaultGasLimit: 160000,
  useEstimateGasLimit: true,
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
} = createTransactionService(client$, network$, arbRpc$, evmGasMultiplier$, enhancedClient$)
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
