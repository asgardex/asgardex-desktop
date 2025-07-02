import { Context as ReactContext, useContext } from 'react'

import { NoContextError } from './NoContextError'

export function createContextHook<T>(Context: ReactContext<T | undefined>, contextId: string) {
  return () => {
    const context = useContext(Context)

    if (context === undefined) {
      throw new NoContextError(contextId)
    }

    return context
  }
}
