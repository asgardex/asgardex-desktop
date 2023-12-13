import { useCallback } from 'react'

import { useObservableState } from 'observable-hooks'

import { useAppContext } from '../contexts/AppContext'
import { ChangePrivateDataHandler } from '../services/app/types'

export const usePrivateData = (): { isPrivate: boolean; changePrivateData: ChangePrivateDataHandler } => {
  const { privateData$, changePrivateData } = useAppContext()

  const isPrivate = useObservableState<boolean>(privateData$, false)

  const changePrivateDataHandler = useCallback(
    (isPrivate: boolean) => {
      changePrivateData(isPrivate)
    },
    [changePrivateData]
  )

  return { isPrivate, changePrivateData: changePrivateDataHandler }
}
