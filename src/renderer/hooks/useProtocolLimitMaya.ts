import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import { CACAO_DECIMAL } from '../../shared/utils/chainIds'

import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import { liveData } from '../helpers/rx/liveData'
import { useObservableLayoutState } from './useObservableLayoutState'
import { getLimit, LimitRD } from './useProtocolLimit'

export const useProtocolLimitMaya = (enabled = true): { data: LimitRD; reload: FP.Lazy<void> } => {
  const {
    service: { networkInfo$, reloadNetworkInfo }
  } = useMidgardMayaContext()

  const source$ = useMemo((): Rx.Observable<LimitRD> => {
    if (!enabled) return Rx.EMPTY
    return FP.pipe(
      networkInfo$,
      liveData.map(({ totalPooledRune, bondMetrics: { totalActiveBond } }) =>
        getLimit(totalPooledRune, totalActiveBond, CACAO_DECIMAL)
      )
    )
  }, [enabled, networkInfo$])

  const data = useObservableLayoutState(source$, RD.initial)

  return { data, reload: reloadNetworkInfo }
}
