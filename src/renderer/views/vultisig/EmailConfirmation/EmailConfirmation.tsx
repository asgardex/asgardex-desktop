import { useCallback, useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { FlatButton } from '../../../components/uielements/button'
import { Input } from '../../../components/uielements/input/Input'
import { Label } from '../../../components/uielements/label'
import * as vultisigRoutes from '../../../routes/vultisig'
import { useVultisig } from '../../../store/vultisig/hooks'
import { verifyVaultEmailCode } from '../../../vultisig/core/mpc/fast/api/verifyVaultEmailCode'
import { getVaultId } from '../../../vultisig/core/ui/vault/Vault'

export const EmailConfirmation = () => {
  const [otp, setOtp] = useState('')
  const navigate = useNavigate()

  const { vault } = useVultisig()
  const { isPending, mutate, isSuccess } = useMutation({
    mutationFn: (code: string) => {
      if (!vault) throw new Error('Vault is not available')
      return verifyVaultEmailCode({
        vaultId: getVaultId(vault),
        code
      })
    }
  })

  const onVerify = useCallback(() => {
    mutate(otp)
  }, [mutate, otp])

  useEffect(() => {
    if (isSuccess) navigate(vultisigRoutes.vaultBackup.path())
  }, [isSuccess, navigate, vault])

  return (
    <div
      className={clsx('flex flex-col h-full items-center justify-center p-8 gap-4', 'bg-bg0 dark:bg-bg0d rounded-lg')}>
      {isPending ? (
        <Label>Verifying...</Label>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 max-w-96 w-full">
          <Input placeholder="Verification Code" value={otp} onChange={(e) => setOtp(e.target.value)} />
          <FlatButton onClick={onVerify}>Verify</FlatButton>
        </div>
      )}
    </div>
  )
}
