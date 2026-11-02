import * as RD from '@devexperts/remote-data-ts'
import { Client } from '@xchainjs/xchain-mayachain'
import { option as O } from 'fp-ts'
import * as RxOp from 'rxjs/operators'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { createEnhancedClient$ } from '../clients/enhancedClient'
import { WalletBalancesRD } from '../clients/types'
import { appWalletService } from '../wallet/appWallet'
import { isStandaloneLedgerMode, isVultisigMode } from '../wallet/types'
import { checkFailed$, client$, readOnlyClient$, rebuildClient } from './common'

/**
 * xchainjs caches the connected RPC clients for the lifetime of a `Client`. If the first connect fails
 * (e.g. `429`), that list stays empty and every call fails with "No clients available. Can not ..."
 * (no "Last error"). Only a new client recovers. Any other failure recovers by reloading.
 */
export const isEmptyClientListError = (msg: string): boolean =>
  msg.startsWith('No clients available') && !msg.includes('Last error')

/**
 * Rebuild state of the MAYA balances client (shared by keystore and Ledger/Vultisig loads).
 * ok: Refresh reloads · stuck (connect or node check failed): next Refresh builds a new client (never automatic)
 * rebuilding: Refresh ignored for up to `REBUILD_TIMEOUT_MS`. Another `client` starts with ok.
 */
type RebuildState = {
  status: 'ok' | 'stuck' | 'rebuilding'
  client: O.Option<Client>
  since: number // `performance.now()` of the last rebuild
}

const { get: getRebuildState, set: setRebuildState } = observableState<RebuildState>({
  status: 'ok',
  client: O.none,
  since: 0
})

// After this time a Refresh reloads as usual, so a hanging rebuild can't leave Refresh dead
const REBUILD_TIMEOUT_MS = 10_000

const isSameClient = (a: O.Option<Client>, b: O.Option<Client>): boolean =>
  O.getEq<Client>({ equals: (x, y) => x === y }).equals(a, b)

const trackClient = (oClient: O.Option<Client>) =>
  setRebuildState((state) => {
    if (isSameClient(state.client, oClient)) return state
    // A rebuild without a client (wallet locked): next Refresh tries again
    if (state.status === 'rebuilding')
      return { ...state, status: O.isSome(oClient) ? 'rebuilding' : 'stuck', client: oClient }
    return { status: 'ok', client: oClient, since: 0 }
  })

// A node check of the client used for balances failed (unlock, network change, rebuild): next Refresh tries again.
// The read-only client is used in Ledger / Vultisig mode only (as in `enhancedClient$`).
checkFailed$.subscribe(({ readOnly, kept }) => {
  let standalone = false
  appWalletService.appWalletState$.pipe(RxOp.take(1)).subscribe((appWalletState) => {
    standalone = isStandaloneLedgerMode(appWalletState) || isVultisigMode(appWalletState)
  })
  if (readOnly === standalone) setRebuildState((state) => ({ ...state, status: 'stuck', client: kept }))
})

const trackBalances = RxOp.tap<WalletBalancesRD>((balancesRD) => {
  if (RD.isFailure(balancesRD))
    setRebuildState((state) => ({ ...state, status: isEmptyClientListError(balancesRD.error.msg) ? 'stuck' : 'ok' }))
  if (RD.isSuccess(balancesRD)) setRebuildState((state) => ({ ...state, status: 'ok' }))
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
  const { status, since } = getRebuildState()
  const now = performance.now()
  if (status === 'rebuilding') {
    // The new client loads balances by itself, another load would send a second request
    if (now - since < REBUILD_TIMEOUT_MS) return
    setRebuildState((state) => ({ ...state, status: 'ok' }))
  }
  if (status === 'stuck') {
    // Reloading a stuck client fails without any request. The new client loads balances once it's there.
    setRebuildState((state) => ({ ...state, status: 'rebuilding', since: now }))
    rebuildClient()
    return
  }
  setReloadBalances(true)
}

/**
 * Enhanced client that falls back to read-only client for standalone modes (Ledger, Vultisig)
 */
const enhancedClient$ = createEnhancedClient$(client$, readOnlyClient$.pipe(RxOp.map(RD.toOption)))

// `enhancedClient$`, tracking client changes for `RebuildState` once per change
const balancesClient$ = enhancedClient$.pipe(RxOp.tap(trackClient), RxOp.shareReplay({ bufferSize: 1, refCount: true }))

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
    client$: balancesClient$,
    trigger$: reloadBalances$,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletBalanceType: 'all'
  }).pipe(trackBalances)

// State of balances loaded by Client and Address
const balanceByAddress$ = C.balancesByAddress$({
  client$: balancesClient$,
  trigger$: reloadBalances$,
  walletBalanceType: 'all'
})
const getBalanceByAddress$: typeof balanceByAddress$ = (params) => balanceByAddress$(params).pipe(trackBalances)

export { balances$, getBalanceByAddress$, reloadBalances, reloadBalances$, resetReloadBalances, enhancedClient$ }
