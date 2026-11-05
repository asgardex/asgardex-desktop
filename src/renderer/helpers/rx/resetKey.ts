import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

/**
 * Keys held state (e.g. by network): when the key changes, everything held for the previous key is dropped.
 *
 * - `get` is read synchronously on every event, so a source value that arrives in the same tick as the
 *   switch (before `changes$` reaches us) is already handled under the new key, nothing old leaks out.
 * - `changes$` re-evaluates while the source is silent after a switch (replayed first value is fine).
 */
export type ResetKey = {
  get: () => unknown
  changes$?: Rx.Observable<unknown>
}

/** Events of `changes$` as empty ticks (`{}`) */
export const resetKeyTicks$ = <T extends object>(resetKey?: ResetKey): Rx.Observable<T> =>
  resetKey?.changes$ ? resetKey.changes$.pipe(RxOp.map(() => ({}) as T)) : Rx.EMPTY
