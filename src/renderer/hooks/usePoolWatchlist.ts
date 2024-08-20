import { useCallback } from 'react'

import { AnyAsset } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'

import { PoolsWatchList } from '../../shared/api/io'
import { useMidgardContext } from '../contexts/MidgardContext'
import { useNetwork } from './useNetwork'

export const usePoolWatchlist = () => {
  const {
    storage: {
      pools: { watchlist$, addToWatchlist, removeFromWatchlist }
    }
  } = useMidgardContext()

  const { network } = useNetwork()

  const list = useObservableState<PoolsWatchList>(watchlist$, [])

  const add = useCallback((poolAsset: AnyAsset) => addToWatchlist(poolAsset, network), [addToWatchlist, network])

  const remove = useCallback(
    (poolAsset: AnyAsset) => removeFromWatchlist(poolAsset, network),
    [network, removeFromWatchlist]
  )

  return { list, add, remove }
}
