import { BSCChain, Client, BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { baseAmount } from '@xchainjs/xchain-util'

import { createBscParams } from '../../../shared/bsc/const'
import { BSCAssetsFallBack, BscAssetsTestnet } from '../../const'
import { isBscAsset, addressInBscWhitelist } from '../../helpers/assetHelper'
import { network$ } from '../app/service'
import { EVMZeroAddress } from '../evm/const'
import { createEvmChainService } from '../evm/factory'
import { replaceSymbol } from '../evm/utils'
import { bscRpc$, evmGasMultiplier$ } from '../storage/common'
import { keystoreChainHDSettings$ } from '../wallet/keystoreHDSettings'
import { WalletBalance } from '../wallet/types'

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
  chain: BSCChain,
  chainName: 'BSC',
  gasAssetDecimal: BSC_GAS_ASSET_DECIMAL,
  isChainAsset: isBscAsset,
  createClientParams: createBscParams,
  ClientClass: Client,
  rpc$: bscRpc$,
  hdSettings$: keystoreChainHDSettings$(BSCChain),
  addressInWhitelist: addressInBscWhitelist,
  assetsFallback: BSCAssetsFallBack,
  assetsTestnet: BscAssetsTestnet,
  defaultGasLimit: 160000,
  balanceTransform: (balance: WalletBalance) => ({
    ...balance,
    asset: replaceSymbol(balance.asset)
  }),
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
} = createTransactionService(client$, network$, bscRpc$, evmGasMultiplier$, enhancedClient$)
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
