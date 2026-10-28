import * as RD from '@devexperts/remote-data-ts'
import * as RxOp from 'rxjs/operators'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { createEnhancedClient$ } from '../clients/enhancedClient'
import { WalletBalancesRD } from '../clients/types'
import { client$, readOnlyClient$, rebuildClient } from './common'

/**
 * xchainjs fails with "No clients available. Can not ..." (and no "Last error")
 * only if its cached list of connected RPC clients is empty.
 * That happens if the first connect of a client failed (e.g. RPC answered `429`).
 * The list is cached for the lifetime of the client, so reloading can't recover from it.
 * Any other failure (incl. "... Last error: Bad status on response: 429") recovers by reloading.
 */
export const isEmptyClientListError = (msg: string): boolean =>
  msg.startsWith('No clients available') && !msg.includes('Last error')

// Set by a failed balance load with an empty client list, cleared by a successful one.
// Not rebuilt right away: a rebuild while the RPC still answers `429` would fail again,
// so it waits for the next manual reload (Refresh).
let clientNeedsRebuild = false

const trackClientState = RxOp.tap<WalletBalancesRD>((balancesRD) => {
  if (RD.isFailure(balancesRD) && isEmptyClientListError(balancesRD.error.msg)) clientNeedsRebuild = true
  if (RD.isSuccess(balancesRD)) clientNeedsRebuild = false
})

/**
 * `ObservableState` to reload `Balances`
 * Sometimes we need to have a way to understand if it simple "load" or "reload" action
 * e.g. @see src/renderer/services/wallet/balances.ts:getChainBalance$
 */
const { get$: reloadBalances$, set: setReloadBalances } = observableState<boolean>(false)

const resetReloadBalances = () => {
  setReloadBalances(false)
}

const reloadBalances = () => {
  if (clientNeedsRebuild) {
    clientNeedsRebuild = false
    // Reloading the stuck client would fail again without sending any request.
    // A new client connects again, and balances load once it's there.
    // No reload trigger here: it would load a second time with the new client.
    rebuildClient()
    return
  }
  setReloadBalances(true)
}

/**
 * Enhanced client that falls back to read-only client for standalone modes (Ledger, Vultisig)
 */
const enhancedClient$ = createEnhancedClient$(client$, readOnlyClient$.pipe(RxOp.map(RD.toOption)))

// State of balances loaded by Client
const balances$ = ({
  walletType,
  walletAccount,
  walletIndex,
  hdMode
}: {
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}): C.WalletBalancesLD =>
  C.balances$({
    client$: enhancedClient$,
    trigger$: reloadBalances$,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletBalanceType: 'all'
  }).pipe(trackClientState)

// State of balances loaded by Client and Address
const balanceByAddress$ = C.balancesByAddress$({
  client$: enhancedClient$,
  trigger$: reloadBalances$,
  walletBalanceType: 'all'
})
const getBalanceByAddress$: typeof balanceByAddress$ = (params) => balanceByAddress$(params).pipe(trackClientState)

export { balances$, getBalanceByAddress$, reloadBalances, reloadBalances$, resetReloadBalances, enhancedClient$ }
