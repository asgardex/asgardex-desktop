import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { useDropzone } from 'react-dropzone'
import { FlatButton } from '../../../components/uielements/button'
import { Label } from '../../../components/uielements/label'
import { vaultBackupResultFromFile } from '../../../vultisig/core/ui/vault/import/utils/vaultBackupResultFromFile'
import { vaultBackupExtensions } from '../../../vultisig/core/ui/vault/import/VaultBackupExtension'
import {
  FileBasedVaultBackupResult,
  VaultBackupOverride
} from '../../../vultisig/core/ui/vault/import/VaultBackupResult'
import { VaultBackupOverrideProvider } from '../../../vultisig/core/ui/vault/state/vaultBackupOverride'
import { Vault } from '../../../vultisig/core/ui/vault/Vault'
import { MatchRecordUnion } from '../../../vultisig/lib/ui/base/MatchRecordUnion'
import { ValueTransfer } from '../../../vultisig/lib/ui/base/ValueTransfer'
import { shouldBePresent } from '../../../vultisig/lib/utils/assert/shouldBePresent'
import { DecryptVaultStep } from './DecryptVaultStep'
import { ProcessVaultContainer } from './ProcessVaultContainer'
import { SaveImportedVaultStep } from './SaveImportedVaultStep'

export const ImportVaultView = () => {
  const [file, setFile] = useState<File | null>(null)
  const [override, setOverride] = useState<VaultBackupOverride | null>(null)
  const [backupResult, setResult] = useState<FileBasedVaultBackupResult>()
  const { mutate } = useMutation({
    mutationFn: vaultBackupResultFromFile,
    onSuccess: (result) => {
      setResult(result)
      setOverride(result.override ?? null)
    }
  })

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/octet-stream': vaultBackupExtensions.map((extension) => `.${extension}`)
    },
    onDrop: (acceptedFiles) => {
      const [backupfile] = acceptedFiles
      if (backupfile) {
        setFile(backupfile)
      }
    }
  })

  if (!backupResult) {
    return (
      <div
        className={clsx(
          'flex flex-col h-full items-center justify-center p-8 gap-4',
          'bg-bg0 dark:bg-bg0d rounded-lg'
        )}>
        <form onSubmit={() => mutate(shouldBePresent(file))}>
          <div className="flex flex-col items-center justify-center">
            <div className="mb-4 border border-dashed border-turquoise rounded-lg p-8" {...getRootProps()}>
              <input {...getInputProps()} />
              <Label align="center">Select the vault backup file</Label>
            </div>
            <FlatButton type="submit">Import</FlatButton>
          </div>
        </form>
      </div>
    )
  }

  return (
    <VaultBackupOverrideProvider value={override}>
      <MatchRecordUnion
        value={backupResult.result}
        handlers={{
          vaultContainer: (vaultContainer) => <ProcessVaultContainer value={vaultContainer} />,
          vault: (vault) => <SaveImportedVaultStep value={vault} />,
          encryptedVault: (encryptedVault) => (
            <ValueTransfer<Vault>
              from={({ onFinish }) => <DecryptVaultStep value={encryptedVault} onFinish={onFinish} />}
              to={({ value }) => <SaveImportedVaultStep value={value} />}
            />
          )
        }}
      />
    </VaultBackupOverrideProvider>
  )
}
