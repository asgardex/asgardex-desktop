import { useCallback } from 'react'

import { Chain } from '@xchainjs/xchain-util'
import { useDispatch, useSelector } from 'react-redux'

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

  const setProtocol = useCallback(
    (protocol: Chain) => {
      dispatch(actions.setProtocol(protocol))
    },
    [dispatch]
  )

  const setStreamingSlip = useCallback(
    (slip: number) => {
      dispatch(actions.setStreamingSlip(slip))
    },
    [dispatch]
  )

  const setInstantSlip = useCallback(
    (slip: number) => {
      dispatch(actions.setInstantSlip(slip))
    },
    [dispatch]
  )

  const setTradeSlip = useCallback(
    (slip: number) => {
      dispatch(actions.setTradeSlip(slip))
    },
    [dispatch]
  )

  return {
    ...appState,
    changePrivateData,
    setIsWhitelistModalOpen,
    setProtocol,
    setStreamingSlip,
    setInstantSlip,
    setTradeSlip
  }
}
