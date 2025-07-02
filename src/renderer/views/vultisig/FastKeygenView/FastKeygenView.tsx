import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { Label } from '../../../components/uielements/label'
import * as vultisigRoutes from '../../../routes/vultisig'
import { useVultisig } from '../../../store/vultisig/hooks'
import { startMpcSession } from '../../../vultisig/mpc/session/utils/startMpcSession'
import { useMpcDevices } from '../../../vultisig/mpc/state/mpcDevices'

export const FastKeygenView = () => {
  const navigate = useNavigate()
  const { sessionId, mpcServerUrl: serverUrl } = useVultisig()
  const devices = useMpcDevices()

  const { mutate: start, ...status } = useMutation({
    mutationFn: () => {
      return startMpcSession({ serverUrl, sessionId, devices })
    },
    onSuccess: () => {
      navigate(vultisigRoutes.keygenFlow.path())
    }
  })

  useEffect(() => start(), [start])

  return (
    <div
      className={clsx('flex flex-col h-full items-center justify-center p-8 gap-4', 'bg-bg0 dark:bg-bg0d rounded-lg')}>
      <div className="max-w-96 w-full">
        <Label align="center" size="large">
          {status.isPending && 'In Progress'}
          {status.isError && JSON.stringify(status.error)}
        </Label>
      </div>
    </div>
  )
}
