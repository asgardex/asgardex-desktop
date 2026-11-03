import { useCallback, useEffect, useState } from 'react'

/**
 * Some state streams keep the last Success while a reload is running (see `preserveSuccess`),
 * so a view never sees `RD.pending` for a refresh and has nothing to show a "refreshing" state with.
 *
 * `startRefreshing` marks a refresh as running. It ends as soon as `data` changes,
 * i.e. when the reload delivers a new value (success or failure).
 */
export const useRefreshing = <T>(data: T): { refreshing: boolean; startRefreshing: () => void } => {
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    setRefreshing(false)
  }, [data])

  const startRefreshing = useCallback(() => setRefreshing(true), [])

  return { refreshing, startRefreshing }
}
