import { type compactable, type monadTask, either as E, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import { Observable } from 'rxjs'
import * as RxOp from 'rxjs/operators'

const URI = 'Observable'
type URI = typeof URI

// type Observable<A> = Rx.Observable<A>

declare module 'fp-ts/HKT' {
  interface URItoKind<A> {
    readonly Observable: Observable<A>
  }
}

const filterMap = <A, B>(o: Observable<A>, f: (a: A) => O.Option<B>) =>
  o.pipe(RxOp.mergeMap((a) => O.fold(() => Rx.EMPTY, Rx.of<B>)(f(a))))

export const instanceObservable: monadTask.MonadTask1<URI> & compactable.Compactable1<URI> = {
  URI,
  map: (o, f) => o.pipe(RxOp.map(f)), // Functor
  ap: (oF, o) => Rx.combineLatest([oF, o]).pipe(RxOp.map(([f, a]) => f(a))), // Apply
  of: Rx.of, // Applicative
  chain: (o, f) => o.pipe(RxOp.mergeMap(f)), // Monad
  fromIO: (f) => Rx.defer(() => Rx.of(f())), // MonadIO
  fromTask: Rx.defer, // MonadTask
  compact: (o) => filterMap(o, (a) => a), // Compactable
  separate: (o) => ({
    // Compactable
    left: filterMap(o, (a) => O.fromEither(E.swap(a))),
    right: filterMap(o, O.fromEither)
  })
}
