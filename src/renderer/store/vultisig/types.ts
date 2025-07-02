import { Chain } from '../../vultisig/core/chain/Chain'
import { Vault } from '../../vultisig/core/ui/vault/Vault'

export type VaultWithCoin = Vault & Partial<{ coins: { chain: Chain; address: string }[] }>

export type State = {
  vaultName: string
  localPartyId: string
  sessionId: string
  hexChainCode: string
  hexEncryptionKey: string
  mpcServerUrl: string

  peers: string[]
  vault: VaultWithCoin | null
}
