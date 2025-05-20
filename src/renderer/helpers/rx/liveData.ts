import * as RD from '@devexperts/remote-data-ts'
import { instanceObservable } from '@devexperts/rx-utils/dist/observable.utils'
import { getLiveDataM } from '@devexperts/utils/dist/adt/live-data.utils'
import { FoldableValue2 } from '@devexperts/utils/dist/typeclasses/foldable-value/foldable-value'
import {
  CoproductLeft,
  coproductMapLeft
} from '@devexperts/utils/dist/typeclasses/product-left-coproduct-left/product-left-coproduct-left.utils'

import type { filterable as Fi } from 'fp-ts'
import type { monadThrow as MT } from 'fp-ts'
import { apply } from 'fp-ts'
import { array as A } from 'fp-ts'
import { option as O } from 'fp-ts'
import { pipeable as P } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

const { sequenceS, sequenceT } = apply
const { pipeable } = P

export type LiveData<E, A> = Rx.Observable<RD.RemoteData<E, A>>

export const URI = '//LiveData'
type URIType = typeof URI
declare module 'fp-ts/lib/HKT' {
  interface URItoKind2<E, A> {
    [URI]: LiveData<E, A>
  }
}

const foldableValueRemoteData: FoldableValue2<typeof RD.remoteData.URI> & MT.MonadThrow2<typeof RD.remoteData.URI> = {
  ...RD.remoteData,
  foldValue: (fa, onNever, onValue) => (RD.isSuccess(fa) ? onValue(fa.value) : onNever(fa)),
  throwError: RD.failure
}

export const instanceLiveData: MT.MonadThrow2<URIType> & CoproductLeft<URIType> & Fi.Filterable2<URIType> = {
  URI,
  ...getLiveDataM(instanceObservable, foldableValueRemoteData)
}

export const liveData = {
  ...instanceLiveData,
  ...pipeable(instanceLiveData),
  sequenceS: sequenceS(instanceLiveData),
  sequenceT: sequenceT(instanceLiveData),
  sequenceArray: A.sequence(instanceLiveData),
  combine: coproductMapLeft(instanceLiveData),
  mapLeft:
    <L, V, A>(f: (l: L) => V) =>
    (fla: LiveData<L, A>): LiveData<V, A> =>
      fla.pipe(RxOp.map(RD.mapLeft(f))),
  fromObservable: <E, A>(observable$: Rx.Observable<A>, onError: (error: unknown) => E): LiveData<E, A> =>
    observable$.pipe(
      RxOp.map((value) => RD.success(value) as RD.RemoteData<E, A>),
      RxOp.catchError((error) => Rx.of(RD.failure(onError(error))))
    ),
  right: <E, A>(value: A): LiveData<E, A> => Rx.of(RD.success(value)),
  /**
   * LiveData<L,A> => Observable<Option<A>>
   */
  toOption$: <L, A>(fla: LiveData<L, A>): Rx.Observable<O.Option<A>> => fla.pipe(RxOp.map(RD.toOption)),
  /**
   *  1. Maps inner value of LiveData<L, A> with fab => LiveData<L, B>
   *  2. LiveData<L,A> => Observable<Option<A>>
   *
   */
  toOptionMap$:
    <L, A, B>(fab: (fa: A) => B) =>
    (fla: LiveData<L, A>): Rx.Observable<O.Option<B>> =>
      fla.pipe(RxOp.map(RD.map(fab)), RxOp.map(RD.toOption)),
  altOnError:
    <L, A>(f: (l: L) => A) =>
    (fla: LiveData<L, A>): LiveData<L, A> =>
      fla.pipe(
        RxOp.map(
          RD.fold(
            () => RD.initial,
            () => RD.pending,
            (e) => RD.success(f(e)),
            (val) => RD.success(val)
          )
        )
      ),
  chainOnError:
    <L, A>(f: (l: L) => LiveData<L, A>) =>
    (fla: LiveData<L, A>) =>
      fla.pipe(
        RxOp.switchMap(
          RD.fold(
            () => Rx.of(RD.initial),
            () => Rx.of(RD.pending),
            f,
            (val) => Rx.of(RD.success(val))
          )
        )
      )
}
