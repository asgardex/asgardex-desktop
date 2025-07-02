import { useEffect } from 'react'
import { FlatButton } from '../../../components/uielements/button'
import { Label } from '../../../components/uielements/label'
import { useVultisig } from '../../../store/vultisig/hooks'
import { useCreateVaultMutation } from '../../../vultisig/core/ui/vault/mutations/useCreateVaultMutation'
import { Vault } from '../../../vultisig/core/ui/vault/Vault'
import { OnBackProp, OnFinishProp, TitleProp, ValueProp } from '../../../vultisig/lib/ui/props'
import { extractErrorMsg } from '../../../vultisig/lib/utils/error/extractErrorMsg'

export const SaveVaultStep: React.FC<ValueProp<Vault> & OnFinishProp & TitleProp & OnBackProp> = ({
  value,
  onFinish,
  title,
  onBack
}) => {
  const { setVault } = useVultisig()

  const { mutate, ...mutationState } = useCreateVaultMutation({
    onSuccess: onFinish
  })

  useEffect(() => {
    mutate(value)
    console.log('SAVE VAULT - ', value.name)
    setVault(value)
  }, [mutate, value, setVault])

  return (
    <>
      <Label>{title}</Label>
      {mutationState.isPending && <Label>Saving Vault...</Label>}
      {mutationState.error && (
        <div>
          <Label>{extractErrorMsg(mutationState.error)}</Label>
          <FlatButton onClick={onBack}>Back</FlatButton>
        </div>
      )}
    </>
  )
}
