import { useCallback } from 'react'

import { useDispatch, useSelector } from 'react-redux'

import { BaseUnit } from '../../services/const'
import { RootState } from '../store'
import { actions } from './slice'

export const useApp = () => {
  const dispatch = useDispatch()
  const appState = useSelector((state: RootState) => state.app)

  const changePrivateData = useCallback(
    (isPrivate: boolean) => {
      dispatch(actions.changePrivateData(isPrivate))
    },
    [dispatch]
  )

  const setIsWhitelistModalOpen = useCallback(
    (isOpen: boolean) => {
      dispatch(actions.setIsWhitelistModalOpen(isOpen))
    },
    [dispatch]
  )

  const setBtcBaseUnit = useCallback(
    (btcBaseUnit: BaseUnit) => {
      dispatch(actions.setBtcBaseUnit(btcBaseUnit))
    },
    [dispatch]
  )

  return {
    ...appState,
    changePrivateData,
    setIsWhitelistModalOpen,
    setBtcBaseUnit
  }
}
