import { useCallback } from 'react'

import { useObservableState } from 'observable-hooks'

import { Dex } from '../../shared/api/types'
import { useAppContext } from '../contexts/AppContext'
import { ChangeDexHandler } from '../services/app/types'
import { DEFAULT_DEX } from '../services/const'

export const useDex = (): { dex: Dex; changeDex: ChangeDexHandler } => {
  const { dex$, changeDex } = useAppContext()

  const dex = useObservableState<Dex>(dex$, DEFAULT_DEX)

  /**
   * By switching the dex, we have to re-direct to a top level route in following scenarios:
   * (1) Sub-routes of pools are redirected to the top-level route, since we don't have same pools on different dexs
   * (2) Some (not all) sub-routes
   *
   * You might have following questions:
   *
   * (1) Why not handling this at service layer?
   * --------------------------------------------
   * We can't handle this at service layer, because it's recommended by React Router
   * to handle route states on view layer only. And `useDex` is used at view layer only.
   * Quote: "Our recommendation is not to keep your routes in your Redux store at all."
   * ^ @see https://reactrouter.com/web/guides/deep-redux-integration
   *
   * (2) Why don't we handle re-directing in views, where we defined our routes?
   * ------------------------------------------------------------------------------------------------------------------
   * Since we have to subscribe to `dex$` to get changes by using `useSubscription` or something,
   * we get state of dex after first rendering, but not before. With this, components are still trying to render data,
   * which might be deprecated based on dex changes.
   *
   */
  const changeDexHandler = useCallback(
    (dex: Dex) => {
      changeDex(dex)
    },
    [changeDex]
  )

  return { dex, changeDex: changeDexHandler }
}
