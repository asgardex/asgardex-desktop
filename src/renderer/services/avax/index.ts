import { AVAXChain, Client, AVAX_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-avax'
import { baseAmount } from '@xchainjs/xchain-util'

import { createAvaxParams } from '../../../shared/avax/const'
import { AVAXAssetsFallback, AvaxAssetsTestnet } from '../../const'
import { isAvaxAsset, addressInAvaxWhitelist } from '../../helpers/assetHelper'
import { network$ } from '../app/service'
import { EVMZeroAddress } from '../evm/const'
import { createEvmChainService } from '../evm/factory'
import { avaxRpc$, evmGasMultiplier$ } from '../storage/common'
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
  chain: AVAXChain,
  chainName: 'AVAX',
  gasAssetDecimal: AVAX_GAS_ASSET_DECIMAL,
  isChainAsset: isAvaxAsset,
  createClientParams: createAvaxParams,
  ClientClass: Client,
  rpc$: avaxRpc$,
  hdSettings$: keystoreChainHDSettings$(AVAXChain),
  addressInWhitelist: addressInAvaxWhitelist,
  assetsFallback: AVAXAssetsFallback,
  assetsTestnet: AvaxAssetsTestnet,
  defaultGasLimit: 160000,
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
} = createTransactionService(client$, network$, avaxRpc$, evmGasMultiplier$, enhancedClient$)
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
