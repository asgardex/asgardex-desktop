import * as RD from '@devexperts/remote-data-ts'
import { assetFromString, isTradeAsset, type Chain } from '@xchainjs/xchain-util'

import { isSupportedChain } from '../../../../shared/utils/chain'

/** Which tracker produced the row. Trade assets settle on that dex's trade account. */
export type TrackerLedger = 'thor' | 'maya' | 'l1'

export type TrackerRow = {
  id: string
  isComplete: boolean
  fromAsset: string
  toAsset: string
  ledger: TrackerLedger
}

/** A chain wallet, or the single trade account that holds trade-asset units. */
export type DestinationRefresh = { kind: 'chain'; chain: Chain } | { kind: 'thorTrade' } | { kind: 'mayaTrade' }

/** Tracker rows from one protocol stream. Failure and pending yield no rows. */
export const toTrackerRows = (
  rd: RD.RemoteData<unknown, ReadonlyArray<{ id: string; isComplete: boolean; fromAsset: string; toAsset: string }>>,
  ledger: TrackerLedger
): TrackerRow[] =>
  RD.isSuccess(rd)
    ? rd.value.map(({ id, isComplete, fromAsset, toAsset }) => ({ id, isComplete, fromAsset, toAsset, ledger }))
    : []

/**
 * Refreshes for rows this session saw incomplete and that are now complete.
 * A row already complete on first sight does not reload. Each id, chain, and
 * trade account is handled once.
 *
 * Trade-asset strings (`ETH~USDC`) put the L1 in `chain`, but the units live
 * on the THORChain or MAYAChain trade account. The received asset is always
 * refreshed. A spent trade asset is refreshed too, so selling one for an L1
 * does not leave that trade account stale. Both legs of a trade-to-trade
 * swap share one account, and that account is fetched once.
 */
export const newlyCompletedDestinationRefreshes = (
  rows: TrackerRow[],
  watching: Set<string>,
  reloaded: Set<string>
): DestinationRefresh[] => {
  const refreshes: DestinationRefresh[] = []
  const seen = new Set<string>()
  const push = (refresh: DestinationRefresh) => {
    const key = refresh.kind === 'chain' ? `chain:${refresh.chain}` : refresh.kind
    if (seen.has(key)) return
    seen.add(key)
    refreshes.push(refresh)
  }
  const pushAsset = (assetString: string, ledger: TrackerLedger, spentTradeOnly: boolean) => {
    const asset = assetFromString(assetString)
    if (!asset) return
    const trade = isTradeAsset(asset)
    if (spentTradeOnly && !trade) return
    if (trade && ledger === 'thor') {
      push({ kind: 'thorTrade' })
      return
    }
    if (trade && ledger === 'maya') {
      push({ kind: 'mayaTrade' })
      return
    }
    if (spentTradeOnly || !isSupportedChain(asset.chain)) return
    push({ kind: 'chain', chain: asset.chain })
  }
  for (const row of rows) {
    if (reloaded.has(row.id)) continue
    if (!row.isComplete) {
      watching.add(row.id)
      continue
    }
    if (!watching.has(row.id)) continue
    watching.delete(row.id)
    reloaded.add(row.id)
    pushAsset(row.toAsset, row.ledger, false)
    pushAsset(row.fromAsset, row.ledger, true)
  }
  return refreshes
}
