export const LIMIT_FILL_WAIT_MS = 60_000

export const LIMIT_ERROR_PRICE_MOVED = 'pools.chart.tradingPanel.priceLevel.priceMoved'
export const LIMIT_ERROR_BALANCE_LOW = 'pools.chart.tradingPanel.priceLevel.balanceLow'
export const LIMIT_ERROR_NO_ROUTE = 'pools.chart.tradingPanel.priceLevel.noRoute'
export const LIMIT_ERROR_TIMED_OUT = 'pools.chart.tradingPanel.priceLevel.timedOut'

export const LIMIT_ERROR_IDS = [
  LIMIT_ERROR_PRICE_MOVED,
  LIMIT_ERROR_BALANCE_LOW,
  LIMIT_ERROR_NO_ROUTE,
  LIMIT_ERROR_TIMED_OUT
] as const

export type LimitErrorId = (typeof LIMIT_ERROR_IDS)[number]

export const isLimitErrorId = (value: string): value is LimitErrorId =>
  (LIMIT_ERROR_IDS as readonly string[]).includes(value)

export type QuoteFillInput = {
  side: 'buy' | 'sell'
  /** Missing or `usd` compares dollars per chart asset. `pair` compares counter per chart asset. */
  unit: 'usd' | 'pair'
  limit: number
  /** Chart asset sold, or chart asset received on a buy. */
  chartAmount: number
  /** Counter received on a sell, or counter spent on a buy. */
  counterAmount: number
  /** Pool USD of the counter. Required for a USD limit. */
  counterUsd?: number
}

/**
 * Whether the live quote still fills the limit.
 * `true` opens confirmation. `false` means the price moved past the limit.
 * `null` means the quote cannot be compared yet.
 */
export const quoteFillsLimit = (input: QuoteFillInput): boolean | null => {
  const { side, unit, limit, chartAmount, counterAmount, counterUsd } = input
  if (!Number.isFinite(limit) || limit <= 0) return null
  if (!Number.isFinite(chartAmount) || chartAmount <= 0) return null
  if (!Number.isFinite(counterAmount) || counterAmount <= 0) return null

  let exec: number
  if (unit === 'pair') {
    exec = counterAmount / chartAmount
  } else {
    if (counterUsd === undefined || !Number.isFinite(counterUsd) || counterUsd <= 0) return null
    exec = (counterAmount * counterUsd) / chartAmount
  }
  if (!Number.isFinite(exec) || exec <= 0) return null
  // A sell wants at least the limit. A buy wants to pay no more than the limit.
  return side === 'sell' ? exec >= limit : exec <= limit
}

/** Confirm opens the wallet modal. A worse quote fails. A quote we cannot compare keeps waiting. */
export type LimitTriggerAction = 'confirm' | 'fail' | 'wait'

export const limitTriggerAction = (fills: boolean | null): LimitTriggerAction => {
  if (fills === null) return 'wait'
  return fills ? 'confirm' : 'fail'
}

export type LimitPayCheck = 'wait' | 'ok' | 'balance' | 'route'

/** A known balance that does not cover fails. An unknown balance keeps waiting for the load. */
export const limitPayCheck = (balanceKnown: boolean, covers: boolean, canSwap: boolean): LimitPayCheck => {
  if (!balanceKnown) return 'wait'
  if (!canSwap) return 'route'
  if (!covers) return 'balance'
  return 'ok'
}

export type LimitQueueEvent = { levelId: string }

/**
 * Hold a second crossing until the active level finishes.
 * The same level is not queued twice, and an idle watcher starts immediately.
 */
export const enqueueLimitEvent = <T extends LimitQueueEvent>(
  activeId: string | null,
  waiting: readonly T[],
  event: T
): { waiting: T[]; start: T | null } => {
  if (activeId === event.levelId || waiting.some((item) => item.levelId === event.levelId)) {
    return { waiting: [...waiting], start: null }
  }
  if (activeId) return { waiting: [...waiting, event], start: null }
  return { waiting: [...waiting], start: event }
}

export const settleLimitQueue = <T>(waiting: readonly T[]): { next: T | null; waiting: T[] } => {
  if (waiting.length === 0) return { next: null, waiting: [] }
  const [next, ...rest] = waiting
  return { next, waiting: rest }
}
