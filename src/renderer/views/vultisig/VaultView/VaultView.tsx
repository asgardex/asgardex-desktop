import { useEffect } from 'react'
import { Label } from '../../../components/uielements/label'
import { useVultisig } from '../../../store/vultisig/hooks'
import { useCreateVaultMutation } from '../../../vultisig/core/ui/vault/mutations/useCreateVaultMutation'

export const VaultView = () => {
  const { vault } = useVultisig()

  const { mutate } = useCreateVaultMutation()

  useEffect(() => {
    if (vault && !vault?.coins) {
      mutate(vault)
    }
  }, [vault, mutate])

  console.log('VAULT - ', vault)

  return <Label>{JSON.stringify(vault?.coins)}</Label>
}
