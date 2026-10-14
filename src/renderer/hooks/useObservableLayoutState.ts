import { useLayoutEffect, useState } from 'react'

import * as Rx from 'rxjs'

/**
 * Subscribe before paint so a shared stream's current value replaces the previous
 * protocol's state before the browser paints a frame of it.
 */
export const useObservableLayoutState = <T>(source$: Rx.Observable<T>, initial: T): T => {
  const [state, setState] = useState(initial)

  useLayoutEffect(() => {
    const subscription = source$.subscribe(setState)
    return () => subscription.unsubscribe()
  }, [source$])

  return state
}
