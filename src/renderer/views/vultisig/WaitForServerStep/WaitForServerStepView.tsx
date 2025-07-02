import { useCallback, useEffect } from 'react'
import clsx from 'clsx'

import { useNavigate } from 'react-router-dom'
import { Label } from '../../../components/uielements/label'
import * as vultisigRoutes from '../../../routes/vultisig'
import { useVultisig } from '../../../store/vultisig/hooks'
import { isServer } from '../../../vultisig/mpc/devices/localPartyId'
import { useMpcPeerOptionsQuery } from '../../../vultisig/mpc/devices/queries/useMpcPeerOptionsQuery'
import { pluginPeersConfig } from '../../../vultisig/mpc/fast/config'

export const WaitForServerStepView = () => {
  const navigate = useNavigate()
  const { setFastVaultPeers } = useVultisig()

  const peersQuery = useMpcPeerOptionsQuery()

  const handleFastVault = useCallback(() => {
    navigate(vultisigRoutes.fastKeygen.path())
  }, [navigate])

  const onPeersChange = useCallback(
    (peers: string[]) => {
      const isPluginReshare = false

      const shouldFinish = !isPluginReshare || peers.length >= pluginPeersConfig.minimumJoinedParties

      if (shouldFinish) {
        if (isPluginReshare) {
          setFastVaultPeers(peers.filter((device) => !isServer(device)))
        } else {
          setFastVaultPeers(peers)
        }

        handleFastVault()
      }
    },
    [setFastVaultPeers, handleFastVault]
  )

  useEffect(() => {
    if (peersQuery.data) {
      onPeersChange(peersQuery.data)
    }
  }, [onPeersChange, peersQuery.data])

  return (
    <div
      className={clsx('flex flex-col h-full items-center justify-center p-8 gap-4', 'bg-bg0 dark:bg-bg0d rounded-lg')}>
      <div className="max-w-96 w-full">
        <Label align="center" size="large">
          In Progress
        </Label>
      </div>
    </div>
  )
}
