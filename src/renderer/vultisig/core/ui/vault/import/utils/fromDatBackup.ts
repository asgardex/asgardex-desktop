import { shouldBePresent } from '../../../../../lib/utils/assert/shouldBePresent'
import { recordFromKeys } from '../../../../../lib/utils/record/recordFromKeys'
import { convertDuration } from '../../../../../lib/utils/time/convertDuration'
import { signingAlgorithms } from '../../../../chain/signing/SignatureAlgorithm'
import { MpcLib } from '../../../../mpc/mpcLib'
import { Vault } from '../../Vault'

export type DatBackup = {
  name: string
  pubKeyECDSA: string
  signers: string[]
  keyshares: DatBackupKeyshare[]
  createdAt: number
  pubKeyEdDSA: string
  hexChainCode: string
  localPartyID: string
  libType: MpcLib
}

type DatBackupKeyshare = {
  pubkey: string
  keyshare: string
}

export const fromDatBackup = (backup: DatBackup): Vault => {
  const publicKeys = {
    ecdsa: backup.pubKeyECDSA,
    eddsa: backup.pubKeyEdDSA
  }

  const keyShares = recordFromKeys(
    signingAlgorithms,
    (algorithm) =>
      shouldBePresent(backup.keyshares.find((keyShare) => keyShare.pubkey === publicKeys[algorithm])).keyshare
  )

  return {
    name: backup.name,
    publicKeys,
    signers: backup.signers,
    createdAt: backup.createdAt ? convertDuration(backup.createdAt, 's', 'ms') : undefined,
    hexChainCode: backup.hexChainCode,
    localPartyId: backup.localPartyID,
    keyShares,
    libType: backup.libType,
    isBackedUp: true,
    order: 0
  }
}
