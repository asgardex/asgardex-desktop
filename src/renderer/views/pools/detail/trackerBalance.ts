import * as RD from '@devexperts/remote-data-ts'
import { assetFromString, type Chain } from '@xchainjs/xchain-util'

import { isSupportedChain } from '../../../../shared/utils/chain'

export type TrackerRow = {
  id: string
  isComplete: boolean
  toAsset: string
}

/** Tracker rows from one protocol stream. Failure and pending yield no rows. */
export const toTrackerRows = (rd: RD.RemoteData<unknown, ReadonlyArray<TrackerRow>>): TrackerRow[] =>
  RD.isSuccess(rd) ? rd.value.map(({ id, isComplete, toAsset }) => ({ id, isComplete, toAsset })) : []

/**
 * Destination chains for rows that this session saw incomplete and that are now complete.
 * A row that is already complete the first time it appears does not reload.
 * Each id is returned once. Chains in one call are unique.
 */
export const newlyCompletedDestinationChains = (
  rows: TrackerRow[],
  watching: Set<string>,
  reloaded: Set<string>
): Chain[] => {
  const chains: Chain[] = []
  const seen = new Set<Chain>()
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
    if (!asset || !isSupportedChain(asset.chain) || seen.has(asset.chain)) continue
    seen.add(asset.chain)
    chains.push(asset.chain)
  }
  return chains
}
