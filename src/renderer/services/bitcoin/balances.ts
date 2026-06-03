import { HDMode, WalletBalanceType, WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { createEnhancedClient$ } from '../clients'
import { isKeystoreReloadTrigger } from '../wallet/types'
import { client$, clientTR$, readOnlyClient$ } from './common'

/**
 * `ObservableState` to reload `Balances`
 * Sometimes we need to have a way to understand if it simple "load" or "reload" action
 * e.g. @see src/renderer/services/wallet/balances.ts:getChainBalance$
 */
const { get$: reloadBalances$, set: setReloadBalances } = observableState<boolean>(false)
const { get$: reloadLedgerBalances$, set: setReloadLedgerBalances } = observableState<boolean>(false)

/**
 * Enhanced client that falls back to read-only client for standalone ledger mode
 */
const enhancedClient$ = createEnhancedClient$(client$, readOnlyClient$)

/**
 * Enhanced Taproot client. Falls back to the same read-only (P2WPKH) client when
 * no keystore phrase is available so generic providers/explorer URLs still resolve,
 * but the `client$` returned from `addressUITR$` ensures Taproot rows only appear
 * in keystore mode.
 */
const enhancedClientTR$ = createEnhancedClient$(clientTR$, readOnlyClient$)

const resetReloadBalances = (walletType: WalletType) => {
  if (isKeystoreReloadTrigger(walletType)) {
    setReloadBalances(false)
  } else {
    setReloadLedgerBalances(false)
  }
}

const reloadBalances = (walletType: WalletType) => {
  if (isKeystoreReloadTrigger(walletType)) {
    setReloadBalances(true)
  } else {
    setReloadLedgerBalances(true)
  }
}
// State of balances loaded by Client
const balances$ = ({
  walletType,
  walletAccount,
  walletIndex,
  walletBalanceType,
  hdMode
}: {
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  walletBalanceType: WalletBalanceType
  hdMode: HDMode
}): C.WalletBalancesLD => {
  // Select trigger based on wallet type
  const trigger$ = isKeystoreReloadTrigger(walletType) ? reloadBalances$ : reloadLedgerBalances$

  // Route keystore Taproot balances through the P2TR client so `getAddressAsync`
  // yields the `bc1p…` address. SegWit and all Ledger/Vultisig balances continue
  // through the original client.
  const targetClient$ = hdMode === 'p2tr' ? enhancedClientTR$ : enhancedClient$

  return C.balances$({
    client$: targetClient$,
    trigger$,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletBalanceType
  })
}

// State of balances loaded by Client and Address
const getBalanceByAddress$ = (walletBalanceType: WalletBalanceType) =>
  C.balancesByAddress$({ client$: enhancedClient$, trigger$: reloadLedgerBalances$, walletBalanceType })

export { balances$, reloadBalances, getBalanceByAddress$, reloadBalances$, resetReloadBalances }
