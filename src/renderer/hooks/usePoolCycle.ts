import { useCallback, useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP, number as N, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useThorchainContext } from '../contexts/ThorchainContext'
import { eqApiError } from '../helpers/fp/eq'
import { LiveData, liveData } from '../helpers/rx/liveData'
import { ApiError, ErrorId } from '../services/wallet/types'
import { useObservableLayoutState } from './useObservableLayoutState'

type PoolCycleRD = RD.RemoteData<ApiError, number>
type PoolCycleLD = LiveData<ApiError, number>

const eqPoolCycle = RD.getEq<ApiError, number>(eqApiError, N.Eq)

export const usePoolCycle = (
  enabled = true
): {
  poolCycle: PoolCycleRD
  reloadPoolCycle: FP.Lazy<void>
} => {
  const { mimir$, reloadMimir, thorchainConstantsState$, reloadThorchainConstants } = useThorchainContext()

  const tnConstantsPoolCycle$: PoolCycleLD = useMemo(
    () =>
      FP.pipe(
        thorchainConstantsState$,
        liveData.map(({ int_64_values }) => Number(int_64_values?.PoolCycle)),
        liveData.chain((poolCycle) =>
          // validation -> value needs to be a number
          liveData.fromPredicate<Error, number>(
            () => !isNaN(poolCycle),
            () => Error(`Invalid value of constant 'PoolCycle' ${poolCycle} `)
          )(poolCycle)
        ),
        liveData.mapLeft(() => ({ errorId: ErrorId.GET_TC_CONSTANT, msg: 'Unable to get constant of PoolCycle' }))
      ),
    [thorchainConstantsState$]
  )

  const mimirPoolCycle$: PoolCycleLD = useMemo(
    () =>
      FP.pipe(
        mimir$,
        liveData.map(({ POOLCYCLE: poolCycle }) => O.fromNullable(poolCycle)),
        liveData.chain(liveData.fromOption(() => Error('Unable to load pool cycle from Mimir'))),
        liveData.mapLeft(({ message }) => ({ errorId: ErrorId.GET_TC_CONSTANT, msg: message }))
      ),
    [mimir$]
  )

  const getData = useCallback(() => {
    reloadMimir()
    reloadThorchainConstants()
  }, [reloadThorchainConstants, reloadMimir])

  const cycle$ = useMemo((): Rx.Observable<PoolCycleRD> => {
    if (!enabled) return Rx.EMPTY
    return FP.pipe(
      Rx.combineLatest([tnConstantsPoolCycle$, mimirPoolCycle$]),
      RxOp.map(([tnPoolCycleRD, mimirPoolCycleRD]) =>
        FP.pipe(
          mimirPoolCycleRD,
          RD.alt(() => tnPoolCycleRD)
        )
      ),
      RxOp.distinctUntilChanged(eqPoolCycle.equals)
    )
  }, [enabled, mimirPoolCycle$, tnConstantsPoolCycle$])

  const data = useObservableLayoutState(cycle$, RD.initial)

  // Load constants and mimir only for the protocol this screen is showing.
  useEffect(() => {
    if (!enabled) return
    getData()
  }, [enabled, getData])

  return { poolCycle: data, reloadPoolCycle: getData }
}
