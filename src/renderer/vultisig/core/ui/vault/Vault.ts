import { PublicKeys } from '../../chain/publicKey/PublicKeys'
import { SignatureAlgorithm } from '../../chain/signing/SignatureAlgorithm'
import { MpcLib } from '../../mpc/mpcLib'

export type VaultKeyShares = Record<SignatureAlgorithm, string>

export type Vault = {
  name: string
  publicKeys: PublicKeys
  signers: string[]
  createdAt?: number
  hexChainCode: string
  keyShares: VaultKeyShares
  localPartyId: string
  // should only be present in legacy GG20 vaults
  resharePrefix?: string
  libType: MpcLib
  isBackedUp: boolean
  order: number
  folderId?: string
  lastPasswordVerificationTime?: number
}

export const getVaultId = (vault: Vault): string => vault.publicKeys.ecdsa
