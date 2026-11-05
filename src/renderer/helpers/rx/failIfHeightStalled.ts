import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { monotonicNow } from '../monotonicClock'

export type HeightStallOptions<A> = {
  /** Block height of a loaded value (`<= 0`: no height) */
  getHeight: (value: A) => number
  /** A height that has not advanced for this long is no longer trusted */
  stallMs: number
  /** How often the stall is re-checked while the source is silent */
  tickMs?: number
  now?: () => number
}

type Input<A> = RD.RemoteData<Error, A>

export type StallState<A> = { input: Input<A>; height?: number; since?: number }

export const INITIAL_STALL_STATE = <A>(): StallState<A> => ({ input: RD.initial })

/** Records a new value: the clock restarts only when the height changes */
export const stallInput = <A>(
  state: StallState<A>,
  input: Input<A>,
  now: number,
  getHeight: (value: A) => number
): StallState<A> => {
  if (!RD.isSuccess(input)) return { ...state, input }
  const height = getHeight(input.value)
  return height === state.height && state.since !== undefined ? { ...state, input } : { input, height, since: now }
}

/** A Success whose height has not changed for `stallMs` becomes a Failure (halt status unknown) */
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
  <A>({ getHeight, stallMs, tickMs = 5000, now = monotonicNow }: HeightStallOptions<A>) =>
  (source: Rx.Observable<Input<A>>): Rx.Observable<Input<A>> =>
    Rx.merge(
      source.pipe(RxOp.map((rd) => ({ rd }) as { rd?: Input<A> })),
      Rx.interval(tickMs).pipe(RxOp.map((): { rd?: Input<A> } => ({})))
    ).pipe(
      RxOp.scan(
        (state: StallState<A>, { rd }) => (rd ? stallInput(state, rd, now(), getHeight) : state),
        INITIAL_STALL_STATE<A>()
      ),
      RxOp.map((state) => evaluateStall(state, now(), stallMs)),
      RxOp.distinctUntilChanged(
        (a, b) =>
          a._tag === b._tag &&
          (!RD.isSuccess(a) || !RD.isSuccess(b) || a.value === b.value) &&
          (!RD.isFailure(a) || !RD.isFailure(b) || a.error.message === b.error.message)
      )
    )
