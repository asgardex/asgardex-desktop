import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

/**
 * While a reload emits Pending, keep the previous Success.
 * The first Pending (before any Success) still passes through, and Failure replaces the held value.
 */
export const preserveSuccess = <E, A>(source: Rx.Observable<RD.RemoteData<E, A>>): Rx.Observable<RD.RemoteData<E, A>> =>
  source.pipe(
    RxOp.scan(
      (previous: RD.RemoteData<E, A>, next: RD.RemoteData<E, A>): RD.RemoteData<E, A> =>
        RD.isPending(next) && RD.isSuccess(previous) ? previous : next,
      RD.initial as RD.RemoteData<E, A>
    ),
    RxOp.distinctUntilChanged()
  )
