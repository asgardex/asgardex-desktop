import { useEffect } from 'react'
import clsx from 'clsx'

import { useNavigate } from 'react-router-dom'
import { FlatButton } from '../../../components/uielements/button'
import { Label } from '../../../components/uielements/label'
import * as vultisigRoutes from '../../../routes/vultisig'
import { useVultisig } from '../../../store/vultisig/hooks'
import { KeygenStep } from '../../../vultisig/core/mpc/keygen/KeygenStep'
import { useKeygenMutation } from '../../../vultisig/core/ui/mpc/keygen/mutations/useKeygenMutation'
import { hasServer } from '../../../vultisig/mpc/devices/localPartyId'

const content: Record<KeygenStep, string> = {
  prepareVault: 'Preparing Vault',
  ecdsa: 'Generating ECDSA Key',
  eddsa: 'Generating EdDSA Key'
}

export const KeygenFlowView = () => {
  const navigate = useNavigate()
  const { setVault } = useVultisig()
  const { step, mutate: startKeygen, ...keygenMutationState } = useKeygenMutation()

  useEffect(startKeygen, [startKeygen])

  useEffect(() => {
    if (keygenMutationState.isSuccess && keygenMutationState.data) {
      setVault(keygenMutationState.data)

      navigate(vultisigRoutes.emailConfirmation.path())
    }
  }, [keygenMutationState, navigate, setVault])

  return (
    <div
      className={clsx('flex flex-col h-full items-center justify-center p-8 gap-4', 'bg-bg0 dark:bg-bg0d rounded-lg')}>
      {keygenMutationState.isSuccess && keygenMutationState.data && hasServer(keygenMutationState.data.signers) && (
        <>
          <Label align="center" size="large">
            Vault created successfully
          </Label>
          <FlatButton>Next</FlatButton>
        </>
      )}
      {keygenMutationState.isPending && step && (
        <Label align="center" size="large">
          {content[step]}
        </Label>
      )}
    </div>
  )
}
