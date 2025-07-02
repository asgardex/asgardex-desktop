import { useMemo } from 'react'
import { useVultisig } from '../../../store/vultisig/hooks'

export const useMpcDevices = () => {
  const { localPartyId, peers } = useVultisig()

  return useMemo(() => [localPartyId, ...peers], [localPartyId, peers])
}
