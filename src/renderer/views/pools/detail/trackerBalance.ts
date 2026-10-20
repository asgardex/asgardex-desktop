import * as RD from '@devexperts/remote-data-ts'
import { assetFromString, isTradeAsset, type Chain } from '@xchainjs/xchain-util'

import { isSupportedChain } from '../../../../shared/utils/chain'

/** Which tracker produced the row. Trade assets settle on that dex's trade account. */
export type TrackerLedger = 'thor' | 'maya' | 'l1'

export type TrackerRow = {
  id: string
  isComplete: boolean
  toAsset: string
  ledger: TrackerLedger
}

/** A chain wallet, or the single trade account that holds trade-asset units. */
export type DestinationRefresh = { kind: 'chain'; chain: Chain } | { kind: 'thorTrade' } | { kind: 'mayaTrade' }

/** Tracker rows from one protocol stream. Failure and pending yield no rows. */
export const toTrackerRows = (
  rd: RD.RemoteData<unknown, ReadonlyArray<{ id: string; isComplete: boolean; toAsset: string }>>,
  ledger: TrackerLedger
): TrackerRow[] =>
  RD.isSuccess(rd) ? rd.value.map(({ id, isComplete, toAsset }) => ({ id, isComplete, toAsset, ledger })) : []

/**
 * Refreshes for rows this session saw incomplete and that are now complete.
 * A row already complete on first sight does not reload. Each id, chain, and
 * trade account is handled once.
 *
 * Trade-asset strings (`ETH~USDC`) put the L1 in `chain`, but the units live
 * on the THORChain or MAYAChain trade account.
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
  for (const row of rows) {
    if (reloaded.has(row.id)) continue
    if (!row.isComplete) {
      watching.add(row.id)
      continue
    }
    if (!watching.has(row.id)) continue
    watching.delete(row.id)
    reloaded.add(row.id)
    const asset = assetFromString(row.toAsset)
    if (!asset) continue
    if (isTradeAsset(asset) && row.ledger === 'thor') {
      push({ kind: 'thorTrade' })
      continue
    }
    if (isTradeAsset(asset) && row.ledger === 'maya') {
      push({ kind: 'mayaTrade' })
      continue
    }
    if (!isSupportedChain(asset.chain)) continue
    push({ kind: 'chain', chain: asset.chain })
  }
  return refreshes
}
