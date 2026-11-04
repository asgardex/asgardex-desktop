import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

export type HoldLastKnownOptions = {
  /** A held Success older than this is dropped: the value is no longer trusted (-> Failure) */
  maxAgeMs: number
  /** Failed loads in a row that keep the held Success (a 3rd one with `2` drops it) */
  maxFailures: number
  /** Pending for longer than this, with nothing to hold, becomes a Failure */
  pendingTimeoutMs: number
  /** How often age and timeouts are re-checked while the source is silent */
  tickMs?: number
  now?: () => number
}

type Input<A> = RD.RemoteData<Error, A>

export type HoldState<A> = {
  last?: { value: A; at: number }
  failures: number
  input: Input<A>
  pendingSince?: number
}

export const INITIAL_HOLD_STATE = <A>(): HoldState<A> => ({ failures: 0, input: RD.initial })

/** Records a new value of the source */
export const holdInput = <A>(state: HoldState<A>, input: Input<A>, now: number): HoldState<A> => {
  if (RD.isSuccess(input)) return { last: { value: input.value, at: now }, failures: 0, input }
  if (RD.isFailure(input)) return { ...state, failures: state.failures + 1, input, pendingSince: undefined }
  if (RD.isPending(input)) {
    return { ...state, input, pendingSince: RD.isPending(state.input) ? (state.pendingSince ?? now) : now }
  }
  return { ...state, input, pendingSince: undefined }
}

/**
 * What to publish for a state at `now`:
 * - Success: published while it is younger than `maxAgeMs`, otherwise Failure("stale")
 * - Failure: the held Success is kept for up to `maxFailures` failures in a row
 * - Pending: the held Success is kept; with nothing held, Pending turns into Failure after `pendingTimeoutMs`
 */
export const evaluateHold = <A>(
  { last, failures, input, pendingSince }: HoldState<A>,
  now: number,
  { maxAgeMs, maxFailures, pendingTimeoutMs }: HoldLastKnownOptions
): Input<A> => {
  if (last && now - last.at >= maxAgeMs) {
    return RD.failure(new Error(`Last known value is older than ${Math.round(maxAgeMs / 1000)}s`))
  }
  if (RD.isSuccess(input)) return input
  if (RD.isFailure(input)) {
    return last && failures <= maxFailures ? RD.success(last.value) : input
  }
  if (RD.isPending(input)) {
    if (last) return RD.success(last.value)
    if (pendingSince !== undefined && now - pendingSince >= pendingTimeoutMs) {
      return RD.failure(new Error(`Still loading after ${Math.round(pendingTimeoutMs / 1000)}s`))
    }
    return input
  }
  return input
}

const sameOutput = <A>(a: Input<A>, b: Input<A>): boolean => {
  if (a._tag !== b._tag) return false
  if (RD.isSuccess(a) && RD.isSuccess(b)) return a.value === b.value
  if (RD.isFailure(a) && RD.isFailure(b)) return a.error.message === b.error.message
  return true
}

/**
 * Makes a `RemoteData` stream safe to take decisions on (halt status):
 * a loaded value is trusted only while fresh, one or two failed reloads are tolerated, and a load that
 * never finishes ends as a Failure. Re-checks on a timer, so it also acts while the source is silent.
 * Applied after `preserveSuccess`, which already holds a Success across reload Pending.
 */
export const holdLastKnown =
  <A>(options: HoldLastKnownOptions) =>
  (source: Rx.Observable<Input<A>>): Rx.Observable<Input<A>> => {
    const now = options.now ?? Date.now
    return Rx.merge(
      source.pipe(RxOp.map((rd) => ({ rd }) as { rd?: Input<A> })),
      Rx.interval(options.tickMs ?? 5000).pipe(RxOp.map((): { rd?: Input<A> } => ({})))
    ).pipe(
      RxOp.scan((state, { rd }) => (rd ? holdInput(state, rd, now()) : state), INITIAL_HOLD_STATE<A>()),
      RxOp.map((state) => evaluateHold(state, now(), options)),
      RxOp.distinctUntilChanged(sameOutput)
    )
  }
