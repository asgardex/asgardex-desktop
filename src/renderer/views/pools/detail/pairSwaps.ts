import { AnyAsset, BaseAmount, assetFromString } from '@xchainjs/xchain-util'

import { sameMarketAsset } from '../../../helpers/tradeAssetHelper'
import { formatSwapAmount } from './swapAmountDisplay'

export type PairSwapSide = 'buy' | 'sell'
export type PairSwapStatus = 'pending' | 'completed' | 'failed'

/** One row in the pair list. Amounts are display strings. A live swap may not have them yet. */
export type PairSwapRow = {
  id: string
  side: PairSwapSide
  /** Chart-asset amount. Null while a tracked swap has no settled figure. */
  size: string | null
  /** Counter amount. Null when the outbound has not been recorded. */
  counter: string | null
  counterTicker: string
  status: PairSwapStatus
  at: number
}

export type PairSwapLeg = {
  txID: string
  values: { asset: AnyAsset; amount: BaseAmount }[]
}

/** Midgard action, narrowed to the fields the list reads. */
export type PairSwapAction = {
  date: Date
  type: string
  in: PairSwapLeg[]
  out: PairSwapLeg[]
}

/** In-flight tracker row. The amount is base units of an unknown decimal, so it is not shown. */
export type PairSwapTracked = {
  txHash: string
  startTime: number
  fromAsset: string
  toAsset: string
  isComplete: boolean
}

const MAX_ROWS = 20

const matches = (asset: AnyAsset, target: AnyAsset): boolean => sameMarketAsset(asset, target)

const firstAmount = (legs: PairSwapLeg[], target: AnyAsset): BaseAmount | null => {
  for (const leg of legs) {
    for (const value of leg.values) {
      if (matches(value.asset, target)) return value.amount
    }
  }
  return null
}

const hasAsset = (legs: PairSwapLeg[], target: AnyAsset): boolean => firstAmount(legs, target) !== null

const txIdOf = (action: PairSwapAction): string => {
  for (const leg of [...action.in, ...action.out]) {
    if (leg.txID) return leg.txID
  }
  return `${action.type}-${action.date.getTime()}`
}

const actionStatus = (type: string): PairSwapStatus => (type === 'REFUND' || type === 'FAILED' ? 'failed' : 'completed')

const rowFromAction = (action: PairSwapAction, pool: AnyAsset, counter: AnyAsset | null): PairSwapRow | null => {
  const inboundPool = hasAsset(action.in, pool)
  const outboundPool = hasAsset(action.out, pool)
  if (!inboundPool && !outboundPool) return null
  const legs = [...action.in, ...action.out]
  if (counter && !hasAsset(legs, counter)) return null

  const side: PairSwapSide = inboundPool ? 'sell' : 'buy'
  const poolAmount = firstAmount(inboundPool ? action.in : action.out, pool)
  const counterAmount = counter ? firstAmount(side === 'sell' ? action.out : action.in, counter) : null
  const counterAsset = counterAmount && counter ? counter : null

  return {
    id: txIdOf(action).toLowerCase(),
    side,
    size: poolAmount ? formatSwapAmount(poolAmount) : null,
    counter: counterAmount ? formatSwapAmount(counterAmount) : null,
    counterTicker: counterAsset?.ticker ?? counter?.ticker ?? '',
    status: actionStatus(action.type),
    at: action.date.getTime()
  }
}

const rowFromTracked = (tx: PairSwapTracked, pool: AnyAsset, counter: AnyAsset | null): PairSwapRow | null => {
  const from = assetFromString(tx.fromAsset)
  const to = assetFromString(tx.toAsset)
  if (!from || !to) return null
  const fromPool = matches(from, pool)
  const toPool = matches(to, pool)
  if (!fromPool && !toPool) return null
  if (counter && !matches(from, counter) && !matches(to, counter)) return null
  const side: PairSwapSide = fromPool ? 'sell' : 'buy'
  const counterAsset = side === 'sell' ? to : from
  return {
    id: tx.txHash.toLowerCase(),
    side,
    size: null,
    counter: null,
    counterTicker: counterAsset.ticker,
    status: tx.isComplete ? 'completed' : 'pending',
    at: tx.startTime
  }
}

/** Newest first. A tracked swap is hidden once Midgard has the same transaction. */
export const rowsForPair = (
  actions: PairSwapAction[],
  tracked: PairSwapTracked[],
  pool: AnyAsset,
  counter: AnyAsset | null
): PairSwapRow[] => {
  const history = actions
    .map((action) => rowFromAction(action, pool, counter))
    .filter((row): row is PairSwapRow => row !== null)
  const seen = new Set(history.map((row) => row.id))
  const live = tracked
    .map((tx) => rowFromTracked(tx, pool, counter))
    .filter((row): row is PairSwapRow => row !== null && !seen.has(row.id))
  return [...history, ...live].sort((a, b) => b.at - a.at).slice(0, MAX_ROWS)
}
