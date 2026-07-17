import { ETHChain, Client, ETH_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-ethereum'

import { etherscanApiKey } from '../../../shared/api/etherscan'
import { createEthParams } from '../../../shared/ethereum/const'
import { ETHAssetsFallBack, ETHAssetsTestnet } from '../../const'
import { isEthAsset, addressInERC20Whitelist } from '../../helpers/assetHelper'
import { network$ } from '../app/service'
import { createEvmChainService } from '../evm/factory'
import { ethRpc$, evmGasMultiplier$ } from '../storage/common'
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
  chain: ETHChain,
  chainName: 'ETH',
  gasAssetDecimal: ETH_GAS_ASSET_DECIMAL,
  isChainAsset: isEthAsset,
  createClientParams: createEthParams,
  ClientClass: Client,
  rpc$: ethRpc$,
  hdSettings$: keystoreChainHDSettings$(ETHChain),
  apiKey: etherscanApiKey,
  addressInWhitelist: addressInERC20Whitelist,
  assetsFallback: ETHAssetsFallBack,
  assetsTestnet: ETHAssetsTestnet,
  defaultGasLimit: 160000,
  initialReloadFeesParams: undefined
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
} = createTransactionService(client$, network$, ethRpc$, evmGasMultiplier$, enhancedClient$)
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
