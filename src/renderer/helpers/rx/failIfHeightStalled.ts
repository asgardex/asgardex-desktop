import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { createFailClosedClock } from '../monotonicClock'
import { ResetKey, resetKeyTicks$ } from './resetKey'

export type HeightStallOptions<A> = {
  /** Block height of a loaded value (`<= 0`: no height) */
  getHeight: (value: A) => number
  /** A height that has not advanced for this long is no longer trusted */
  stallMs: number
  /** How often the stall is re-checked while the source is silent */
  tickMs?: number
  now?: () => number
  /** Highest height and clock are dropped (back to Pending) when this key changes, e.g. the network */
  resetKey?: ResetKey
}

type Input<A> = RD.RemoteData<Error, A>

/** `height`: highest height seen, `since`: when it was first seen */
export type StallState<A> = { input: Input<A>; height?: number; since?: number }

export const INITIAL_STALL_STATE = <A>(): StallState<A> => ({ input: RD.initial })

/** Records a new value: the clock restarts only when the height is strictly higher than the highest seen */
export const stallInput = <A>(
  state: StallState<A>,
  input: Input<A>,
  now: number,
  getHeight: (value: A) => number
): StallState<A> => {
  if (!RD.isSuccess(input)) return { ...state, input }
  const height = getHeight(input.value)
  // Only a new *highest* height is progress: a lower or repeated one (node behind, flapping between
  // two nodes, a height going backwards) must not restart the stall clock
  return state.height !== undefined && state.since !== undefined && height <= state.height
    ? { ...state, input }
    : { input, height, since: now }
}

/** A Success whose highest height has not increased for `stallMs` becomes a Failure (halt status unknown) */
export const evaluateStall = <A>({ input, since }: StallState<A>, now: number, stallMs: number): Input<A> =>
  RD.isSuccess(input) && since !== undefined && now - since >= stallMs
    ? RD.failure(new Error(`Block height has not advanced for ${Math.round(stallMs / 60000)} min`))
    : input

/**
 * A node can keep answering HTTP 200 with the same `lastblock` height (stuck node, stale cache / proxy).
 * Scheduled halts are compared against that height, so a frozen height must not count as fresh:
 * if it does not advance for `stallMs` the value turns into a Failure.
 */
export const failIfHeightStalled =
  <A>({ getHeight, stallMs, tickMs = 5000, now: nowOption, resetKey }: HeightStallOptions<A>) =>
  (source: Rx.Observable<Input<A>>): Rx.Observable<Input<A>> =>
    // one clock per subscription
    Rx.defer(() => {
      const now = nowOption ?? createFailClosedClock()
      return Rx.merge(
        source.pipe(RxOp.map((rd) => ({ rd }) as { rd?: Input<A> })),
        Rx.interval(tickMs).pipe(RxOp.map((): { rd?: Input<A> } => ({}))),
        resetKeyTicks$<{ rd?: Input<A> }>(resetKey)
      ).pipe(
        RxOp.scan(
          ({ key, state }: { key: unknown; state: StallState<A> }, { rd }) => {
            const currentKey = resetKey?.get()
            // key changed: the max height of the previous key must not be compared with the new one
            const base: StallState<A> = currentKey === key ? state : { input: RD.pending }
            return { key: currentKey, state: rd ? stallInput(base, rd, now(), getHeight) : base }
          },
          { key: resetKey?.get(), state: INITIAL_STALL_STATE<A>() }
        ),
        RxOp.map(({ state }) => evaluateStall(state, now(), stallMs)),
        RxOp.distinctUntilChanged(
          (a, b) =>
            a._tag === b._tag &&
            (!RD.isSuccess(a) || !RD.isSuccess(b) || a.value === b.value) &&
            (!RD.isFailure(a) || !RD.isFailure(b) || a.error.message === b.error.message)
        )
      )
    })
