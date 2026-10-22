import { AnyAsset, Chain } from '@xchainjs/xchain-util'

import { sameMarketAsset, supportsTradeSettlement, toPoolAsset, toTradeAsset } from '../../../helpers/tradeAssetHelper'

export type ChartTicketState = {
  tradeMode?: 'buy' | 'sell'
  settlement?: 'wallet' | 'trade'
  counter?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** Route state for a chart opened by changing the ticket's chart asset. */
export const readChartTicketState = (state: unknown): ChartTicketState | null => {
  if (!isRecord(state)) return null
  const tradeMode = state.tradeMode === 'buy' || state.tradeMode === 'sell' ? state.tradeMode : undefined
  const settlement = state.settlement === 'wallet' || state.settlement === 'trade' ? state.settlement : undefined
  const counter = typeof state.counter === 'string' && state.counter.length > 0 ? state.counter : undefined
  if (!tradeMode && !settlement && !counter) return null
  return { tradeMode, settlement, counter }
}

/**
 * Counter to keep when the chart asset changes.
 * Picking the current counter as the new chart asset moves the old chart asset over.
 */
export const counterAfterChartChange = (next: AnyAsset, chart: AnyAsset, counter: AnyAsset | null): AnyAsset | null => {
  const nextPool = toPoolAsset(next)
  const chartPool = toPoolAsset(chart)
  if (!counter) return null
  const counterPool = toPoolAsset(counter)
  if (sameMarketAsset(counterPool, nextPool)) return chartPool
  if (sameMarketAsset(counterPool, chartPool)) return null
  return counterPool
}

/** Pool route for the asset the ticket is now trading. Trade settlement keeps the trade id. */
export const chartRouteAsset = (asset: AnyAsset, settlement: 'wallet' | 'trade', protocol: Chain): AnyAsset => {
  const pool = toPoolAsset(asset)
  if (settlement === 'trade' && supportsTradeSettlement(pool, protocol)) return toTradeAsset(pool, protocol)
  return pool
}
