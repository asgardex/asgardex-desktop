import { useCallback, useEffect } from 'react'
import clsx from 'clsx'

import { useNavigate } from 'react-router-dom'
import { BaseButton } from '../../../components/uielements/button'
import { Input } from '../../../components/uielements/input/Input'
import * as vultisigRoutes from '../../../routes/vultisig'
import { useEmail, usePassword, useVaultName, useVultisig } from '../../../store/vultisig/hooks'
import { setupVaultWithServer } from '../../../vultisig/core/mpc/fast/api/setupVaultWithServer'
import { generateLocalPartyId } from '../../../vultisig/mpc/devices/localPartyId'

export const SetupFastVaultView = () => {
  const navigate = useNavigate()

  const { name, setName } = useVaultName()
  const { email, setEmail } = useEmail()
  const { password, setPassword } = usePassword()

  const { sessionId, hexChainCode, hexEncryptionKey, initFastVault } = useVultisig()

  useEffect(() => {
    initFastVault()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = useCallback(async () => {
    await setupVaultWithServer({
      name,
      encryption_password: password,
      session_id: sessionId,
      hex_chain_code: hexChainCode,
      hex_encryption_key: hexEncryptionKey,
      local_party_id: generateLocalPartyId('server'),
      email,
      lib_type: 1
    })

    navigate(vultisigRoutes.waitForServer.path())
  }, [email, hexChainCode, hexEncryptionKey, name, navigate, password, sessionId])

  return (
    <div
      className={clsx('flex flex-col h-full items-center justify-center p-8 gap-4', 'bg-bg0 dark:bg-bg0d rounded-lg')}>
      <div className="flex flex-col items-center justify-center cursor-pointer border border-solid border-gray0 dark:border-gray0d p-8 max-w-96 w-full rounded-lg space-y-2">
        <Input uppercase={false} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input uppercase={false} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          uppercase={false}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <BaseButton className="rounded px-4 py-2 bg-turquoise text-white hover:bg-turquoise/80" onClick={handleCreate}>
          Create
        </BaseButton>
      </div>
    </div>
  )
}
