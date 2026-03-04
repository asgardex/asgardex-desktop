import React, { createContext, useContext } from 'react'

import { option as O } from 'fp-ts'

import { EvmHDMode } from '../../shared/evm/types'
import type * as EvmServices from '../services/ethereum'
import { evmHDMode$, modifyStorage } from '../services/storage/common'

type EvmChainServices = typeof EvmServices

export type EvmContextValue = EvmChainServices & {
  evmHDMode$: typeof evmHDMode$
  updateEvmHDMode: (m: EvmHDMode) => void
}

const updateEvmHDMode = (mode: EvmHDMode) => {
  modifyStorage(O.some({ evmDerivationMode: mode }))
}

export const createEvmContext = (services: EvmChainServices, name: string) => {
  const initialContext: EvmContextValue = {
    ...services,
    evmHDMode$,
    updateEvmHDMode
  }

  const Context = createContext<EvmContextValue | null>(null)

  const Provider = ({ children }: { children: React.ReactNode }): JSX.Element => {
    return <Context.Provider value={initialContext}>{children}</Context.Provider>
  }

  const useEvmChainContext = () => {
    const context = useContext(Context)
    if (!context) {
      throw new Error(`Context must be used within a ${name}Provider.`)
    }
    return context
  }

  return { Provider, useEvmChainContext }
}
