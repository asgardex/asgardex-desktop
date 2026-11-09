import { useCallback, useEffect, useMemo, useState } from 'react'

import { option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { XMRChain } from '../../../shared/utils/chainIds'
import { pendingAck$ } from '../../services/monero'
import { acknowledgeXmrReceive } from '../../services/monero/ack'
import { removeChain, userChains$ } from '../../services/storage/userChains'
import { MoneroReceiveAckDialog } from './MoneroModals'

/**
 * Shown while XMR is enabled and the receive-only terms of the current wallet are not acknowledged yet.
 * Until then the XMR address is not shown and no Monero node is contacted.
 * "Disable Monero" turns the chain off again.
 */
export const MoneroReceiveAckModal = (): JSX.Element | null => {
  const oPending = useObservableState(pendingAck$, O.none)
  const enabledChains = useObservableState(userChains$, [])
  const [hidden, setHidden] = useState(false)

  const pending = useMemo(() => (O.isSome(oPending) ? oPending.value : undefined), [oPending])
  useEffect(() => setHidden(false), [pending?.address, pending?.network])

  const onAcknowledge = useCallback(() => {
    if (pending) acknowledgeXmrReceive(pending.network, pending.address)
  }, [pending])
  const onDisable = useCallback(() => {
    removeChain(XMRChain)
    setHidden(true)
  }, [])

  if (!pending || hidden || !enabledChains.includes(XMRChain)) return null
  return <MoneroReceiveAckDialog onAcknowledge={onAcknowledge} onDisable={onDisable} />
}
