import { type applicative } from 'fp-ts'
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

export const instanceObservable: applicative.Applicative1<URI> = {
  URI,
  map: (o, f) => o.pipe(RxOp.map(f)), // Functor
  ap: (oF, o) => Rx.combineLatest([oF, o]).pipe(RxOp.map(([f, a]) => f(a))), // Apply
  of: Rx.of // Applicative
}
