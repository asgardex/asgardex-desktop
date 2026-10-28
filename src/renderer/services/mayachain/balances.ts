import * as RD from '@devexperts/remote-data-ts'
import { Client } from '@xchainjs/xchain-mayachain'
import { option as O } from 'fp-ts'
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

/**
 * Whether the MAYA client used for balances needs to be built again:
 *
 * - `ok`: Refresh reloads balances.
 * - `stuck`: the last load failed with an empty client list. The next Refresh builds a new client.
 *   Not rebuilt right away: a rebuild while the RPC still answers `429` would fail again,
 *   so it waits for the next manual reload (Refresh). Can't loop.
 * - `rebuilding`: a new client is on its way and loads balances by itself once it's there.
 *   Another Refresh meanwhile is ignored, it would send a second request (up to `REBUILD_TIMEOUT_MS`).
 *
 * `client` is the client the state belongs to. Any other client (unlock, lock, wallet / network / url change)
 * starts with `ok`, so a flag left from a previous client never causes a needless rebuild.
 *
 * Keystore (`balances$`) and Ledger / Vultisig (`getBalanceByAddress$`) loads share this state on purpose:
 * both load with the same client (`balancesClient$`), so a stuck client is stuck for both,
 * and `rebuildClient` builds the keystore and the read-only client again at once.
 */
type RebuildState = {
  status: 'ok' | 'stuck' | 'rebuilding'
  client: O.Option<Client>
  // Time of the last rebuild (`rebuilding` only)
  since: number
}

const { get: getRebuildState, set: setRebuildState } = observableState<RebuildState>({
  status: 'ok',
  client: O.none,
  since: 0
})

// A rebuild normally loads balances within a few seconds (chain id, connect, balances).
// After that time a Refresh reloads as usual, even if the rebuild hasn't loaded anything
// (e.g. a request hangs, or no balances are subscribed right now). So Refresh can't stay dead.
const REBUILD_TIMEOUT_MS = 10_000

const isSameClient = (a: O.Option<Client>, b: O.Option<Client>): boolean =>
  O.getEq<Client>({ equals: (x, y) => x === y }).equals(a, b)

const trackClient = (oClient: O.Option<Client>) =>
  setRebuildState((state) => {
    if (isSameClient(state.client, oClient)) return state
    // A rebuild without a client (chain id request failed, or wallet locked meanwhile): next Refresh tries again.
    if (state.status === 'rebuilding')
      return { ...state, status: O.isSome(oClient) ? 'rebuilding' : 'stuck', client: oClient }
    return { status: 'ok', client: oClient, since: 0 }
  })

// Results seen by `trackBalances` already. A new subscriber gets the last result replayed (`shareBalances`),
// e.g. an old Success while rebuilding. Only a new result tells something about the current client.
const trackedResults = new WeakSet<WalletBalancesRD>()

const trackBalances = RxOp.tap<WalletBalancesRD>((balancesRD) => {
  if (!RD.isFailure(balancesRD) && !RD.isSuccess(balancesRD)) return
  if (trackedResults.has(balancesRD)) return
  trackedResults.add(balancesRD)
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
  const now = Date.now()
  if (status === 'rebuilding') {
    // The new client loads balances by itself, another load would send a second request.
    if (now - since < REBUILD_TIMEOUT_MS) return
    // Client is built again already: reload it. If it's stuck again, its failure says so.
    setRebuildState((state) => ({ ...state, status: 'ok' }))
  }
  if (status === 'stuck') {
    setRebuildState((state) => ({ ...state, status: 'rebuilding', since: now }))
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

// Client for balances: same as `enhancedClient$`, it tracks client changes for `RebuildState` once per change
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
