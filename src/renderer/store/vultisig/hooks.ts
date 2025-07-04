import { useCallback } from 'react'

import { useSelector } from 'react-redux'

import { RootState, useAppDispatch } from '../store'
import { actions } from './slice'
import { VaultWithCoin } from './types'

export const useVaultName = () => {
  const dispatch = useAppDispatch()
  const name = useSelector((state: RootState) => state.vultisig.name)

  const setName = useCallback(
    (vaultName: string) => {
      dispatch(actions.setVaultName(vaultName))
    },
    [dispatch]
  )

  return { name, setName }
}

export const useEmail = () => {
  const dispatch = useAppDispatch()
  const email = useSelector((state: RootState) => state.vultisig.email)

  const setEmail = useCallback(
    (vaultEmail: string) => {
      dispatch(actions.setEmail(vaultEmail))
    },
    [dispatch]
  )

  return { email, setEmail }
}

export const usePassword = () => {
  const dispatch = useAppDispatch()
  const password = useSelector((state: RootState) => state.vultisig.password)

  const setPassword = useCallback(
    (vaultPassword: string) => {
      dispatch(actions.setPassword(vaultPassword))
    },
    [dispatch]
  )

  return { password, setPassword }
}

export const useKeygenOperation = () => {
  const dispatch = useAppDispatch()
  const keygenOperation = useSelector((state: RootState) => state.vultisig.keygenOperation)

  const setKeygenOperation = useCallback(
    (vaultPassword: string) => {
      dispatch(actions.setPassword(vaultPassword))
    },
    [dispatch]
  )

  return { keygenOperation, setKeygenOperation }
}

export const useVultisig = () => {
  const dispatch = useAppDispatch()

  const vultisigState = useSelector((state: RootState) => state.vultisig)

  const initFastVault = useCallback(() => {
    dispatch(actions.initFastVault())
  }, [dispatch])

  const setFastVaultPeers = useCallback(
    (peers: string[]) => {
      dispatch(actions.setMpcPeers(peers))
    },
    [dispatch]
  )

  const setVaultName = useCallback(
    (vaultName: string) => {
      dispatch(actions.setVaultName(vaultName))
    },
    [dispatch]
  )

  const setVault = useCallback(
    (vault: VaultWithCoin) => {
      dispatch(actions.setVault(vault))
    },
    [dispatch]
  )

  return {
    ...vultisigState,
    initFastVault,
    setFastVaultPeers,
    setVaultName,
    setVault
  }
}
