import { Chain } from '../../vultisig/core/chain/Chain'
import { Vault } from '../../vultisig/core/ui/vault/Vault'
import { KeygenOperation } from '../../vultisig/mpc/keygen/KeygenOperation'

export type VaultWithCoin = Vault & Partial<{ coins: { chain: Chain; address: string }[] }>

export type State = {
  name: string
  password: string
  email: string

  keygenOperation: KeygenOperation

  localPartyId: string
  sessionId: string
  hexChainCode: string
  hexEncryptionKey: string
  mpcServerUrl: string

  peers: string[]
  vault: VaultWithCoin | null
}
