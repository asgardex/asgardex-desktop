import { ARBChain, Client, ARB_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-arbitrum'
import { baseAmount } from '@xchainjs/xchain-util'

import { createArbParams } from '../../../shared/arb/const'
import { ARBAssetsFallback, ArbAssetsTestnet } from '../../const'
import { isAethAsset, addressInArbWhitelist } from '../../helpers/assetHelper'
import { network$ } from '../app/service'
import { EVMZeroAddress } from '../evm/const'
import { createEvmChainService } from '../evm/factory'
import { arbRpc$, evmGasMultiplier$ } from '../storage/common'
import { keystoreChainHDSettings$ } from '../wallet/keystoreHDSettings'

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
  hdSettings$: keystoreChainHDSettings$(ARBChain),
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
  isApprovedERC20Token$,
  getERC20Allowance$
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
  isApprovedERC20Token$,
  getERC20Allowance$
}
