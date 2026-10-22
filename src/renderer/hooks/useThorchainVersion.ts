import * as RD from '@devexperts/remote-data-ts'
import { useObservableState } from 'observable-hooks'

import { useThorchainContext } from '../contexts/ThorchainContext'
import { ThorchainVersion } from '../services/thorchain/types'

export const useThorchainVersion = (): RD.RemoteData<Error, ThorchainVersion> => {
  const { thorchainVersion$ } = useThorchainContext()
  return useObservableState(thorchainVersion$, RD.initial)
}
