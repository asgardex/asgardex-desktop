import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { useVultisig } from '../../../../../../store/vultisig/hooks'
import { KeygenStep } from '../../../../mpc/keygen/KeygenStep'
import { useKeygenAction } from '../state/keygenAction'

export const useKeygenMutation = () => {
  const [step, setStep] = useState<KeygenStep | null>(null)

  const keygenAction = useKeygenAction()

  const { peers } = useVultisig()

  const mutation = useMutation({
    mutationFn: async () => keygenAction({ onStepChange: setStep, peers })
  })

  return {
    ...mutation,
    step
  }
}
