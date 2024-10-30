import React, { createContext, useContext } from 'react'

import { userBondProviders as service } from '../services/storage'

type UserBondProvidersContextValue = typeof service

const initialContext: UserBondProvidersContextValue = service
const UserBondProvidersContext = createContext<UserBondProvidersContextValue | null>(null)

export const UserBondProvidersProvider: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => {
  return <UserBondProvidersContext.Provider value={initialContext}>{children}</UserBondProvidersContext.Provider>
}

export const useUserBondProvidersContext = () => {
  const context = useContext(UserBondProvidersContext)
  if (!context) {
    throw new Error('Context must be used within a UserBondProvidersContext.')
  }
  return context
}
