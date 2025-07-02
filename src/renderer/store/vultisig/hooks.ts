import { useCallback } from 'react'

import { useSelector } from 'react-redux'

import { RootState, useAppDispatch } from '../store'
import { actions } from './slice'
import { VaultWithCoin } from './types'

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
