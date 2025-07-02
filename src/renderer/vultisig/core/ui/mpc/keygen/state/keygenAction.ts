import { getValueProviderSetup } from '../../../../../lib/ui/state/getValueProviderSetup'
import { KeygenStep } from '../../../../mpc/keygen/KeygenStep'

import { Vault } from '../../../vault/Vault'

type KeygenActionInput = {
  onStepChange: (step: KeygenStep) => void
  peers: string[]
}

export type KeygenAction = (input: KeygenActionInput) => Promise<Vault>

export const { useValue: useKeygenAction, provider: KeygenActionProvider } =
  getValueProviderSetup<KeygenAction>('KeygenAction')
