import { MAYAChain } from '@xchainjs/xchain-mayachain'

import { network$ } from '../app/service'
import { createTransactionTrackingService } from '../thorchain/transactionTracking'
import {
  reloadBalances,
  balances$,
  getBalanceByAddress$,
  reloadBalances$,
  resetReloadBalances,
  enhancedClient$
} from './balances'
import {
  client$,
  clientState$,
  address$,
  addressUI$,
  explorerUrl$,
  clientUrl$,
  reloadClientUrl,
  setMayanodeRpcUrl,
  setMayanodeApiUrl
} from './common'
import { createFeesService } from './fees'
import { createInteractService$ } from './interact'
import { createMayanodeService$ } from './mayanode'
import { createTransactionService } from './transaction'

const {
  mayanodeUrl$,
  reloadMayanodeUrl,
  getNodeInfos$,
  reloadNodeInfos,
  reloadMayachainConstants,
  mayachainConstantsState$,
  mayachainLastblockState$,
  reloadMayachainLastblock,
  inboundAddressesShared$,
  loadInboundAddresses$,
  reloadInboundAddresses,
  mimir$,
  reloadMimir,
  getLiquidityProviders,
  reloadLiquidityProviders,
  getLiquidityProvider,
  reloadLiquidityProvider,
  getSaverProvider$,
  reloadSaverProvider,
  getMayanodePools,
  reloadMayanodePools,
  getTradeAccount$,
  reloadTradeAccount,
  getTxStatus$,
  reloadTxStatus,
  getCacaoPoolProvider$,
  reloadCacaoPoolProvider
} = createMayanodeService$(network$, clientUrl$)

const { txs$, tx$, txStatus$, subscribeTx, resetTx, sendTx, txRD$, sendPoolTx$ } = createTransactionService(
  enhancedClient$,
  network$,
  clientUrl$
)
const { reloadFees, fees$ } = createFeesService({ client$: enhancedClient$, chain: MAYAChain })
const interactMaya$ = createInteractService$(sendPoolTx$, txStatus$)
const transactionTrackingService = createTransactionTrackingService(getTxStatus$)

export {
  mayanodeUrl$,
  reloadMayanodeUrl,
  inboundAddressesShared$,
  reloadInboundAddresses,
  loadInboundAddresses$,
  client$,
  clientState$,
  clientUrl$,
  reloadClientUrl,
  setMayanodeRpcUrl,
  setMayanodeApiUrl,
  address$,
  addressUI$,
  explorerUrl$,
  reloadBalances,
  reloadBalances$,
  resetReloadBalances,
  balances$,
  getBalanceByAddress$,
  txs$,
  tx$,
  txStatus$,
  reloadFees,
  fees$,
  subscribeTx,
  resetTx,
  sendTx,
  txRD$,
  sendPoolTx$,
  interactMaya$,
  getNodeInfos$,
  reloadNodeInfos,
  reloadMayachainConstants,
  mayachainConstantsState$,
  mayachainLastblockState$,
  reloadMayachainLastblock,
  mimir$,
  reloadMimir,
  getLiquidityProviders,
  reloadLiquidityProviders,
  getLiquidityProvider,
  reloadLiquidityProvider,
  getSaverProvider$,
  reloadSaverProvider,
  getMayanodePools,
  reloadMayanodePools,
  getTradeAccount$,
  reloadTradeAccount,
  getTxStatus$,
  reloadTxStatus,
  getCacaoPoolProvider$,
  reloadCacaoPoolProvider,
  transactionTrackingService
}
