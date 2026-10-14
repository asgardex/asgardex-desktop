import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

type HoldEvent<E, A> = { readonly _tag: 'value'; readonly value: RD.RemoteData<E, A> } | { readonly _tag: 'reset' }

/**
 * Keep the last Success while a reload emits Pending.
 * reset$ must replay its current value. That first value is ignored; a later one emits Pending
 * and drops the held Success, so a network change cannot keep the previous vault or pools.
 * Reset is subscribed after the source, so a same-turn upstream refresh is cleared afterward.
 */
const holdSuccess = <E, A>(
  source: Rx.Observable<RD.RemoteData<E, A>>,
  reset$?: Rx.Observable<unknown>
): Rx.Observable<RD.RemoteData<E, A>> => {
  const values$ = source.pipe(RxOp.map((value): HoldEvent<E, A> => ({ _tag: 'value', value })))
  const events$ = reset$
    ? Rx.merge(
        values$,
        reset$.pipe(
          RxOp.skip(1),
          RxOp.map((): HoldEvent<E, A> => ({ _tag: 'reset' }))
        )
      )
    : values$

  return events$.pipe(
    RxOp.scan(
      (previous: RD.RemoteData<E, A>, event: HoldEvent<E, A>): RD.RemoteData<E, A> => {
        if (event._tag === 'reset') return RD.pending
        return RD.isPending(event.value) && RD.isSuccess(previous) ? previous : event.value
      },
      RD.initial as RD.RemoteData<E, A>
    ),
    RxOp.distinctUntilChanged()
  )
}

/**
 * While a reload emits Pending, keep the previous Success.
 * The first Pending (before any Success) still passes through, and Failure replaces the held value.
 */
export const preserveSuccess = <E, A>(source: Rx.Observable<RD.RemoteData<E, A>>): Rx.Observable<RD.RemoteData<E, A>> =>
  holdSuccess(source)

/** preserveSuccess that drops the held value when reset$ emits after its current value. */
export const preserveSuccessUntil =
  (reset$: Rx.Observable<unknown>) =>
  <E, A>(source: Rx.Observable<RD.RemoteData<E, A>>): Rx.Observable<RD.RemoteData<E, A>> =>
    holdSuccess(source, reset$)
