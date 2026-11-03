import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

/**
 * `true` while the given request state is `Pending`, `false` otherwise.
 *
 * Use it on the stream of the request itself (not on a derived state), because derived states
 * may keep the last Success while reloading (`preserveSuccess`) or re-emit replayed values.
 */
export const isPending$ = <E, A>(source$: Rx.Observable<RD.RemoteData<E, A>>): Rx.Observable<boolean> =>
  source$.pipe(RxOp.map(RD.isPending), RxOp.distinctUntilChanged(), RxOp.shareReplay(1))
