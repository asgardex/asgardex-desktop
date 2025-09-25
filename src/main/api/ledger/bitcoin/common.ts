import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

import { LedgerErrorId } from '../../../../shared/api/types'
import { isUtxoHDMode } from '../../../../shared/utils/guard'
import { HDMode } from '../../../../shared/wallet/types'

// Bitcoin only supports Native SegWit (P2WPKH) and Taproot (P2TR) address formats
// Other UTXO chains may support different derivation paths
export type UtxoDerivationPathType = 0 | 1

// Convert HDMode to UtxoDerivationPathType for Bitcoin
export const hdModeToDerivationPathType = (hdMode?: HDMode): UtxoDerivationPathType => {
  if (!hdMode || hdMode === 'default') return 0
  if (!isUtxoHDMode(hdMode)) return 0

  switch (hdMode) {
    case 'p2wpkh':
      return 0 // Native Segwit (m/84'/0'/0'/0/{index}) - P2WPKH
    case 'p2tr':
      return 1 // Taproot (handled separately with tapRootDerivationPaths)
    default:
      return 0 // Default to Native SegWit
  }
}

export const getDerivationPath = (
  walletAccount: number,
  network: Network,
  pathType: UtxoDerivationPathType = 0
): string => {
  const coinType = network === Network.Testnet ? "1'" : "0'"

  switch (pathType) {
    case 0: // Native Segwit P2WPKH (m/84'/0'/0'/0/{index})
      return `84'/${coinType}/${walletAccount}'/0/`
    case 1: // Taproot P2TR - this case should not be used here as taproot uses tapRootDerivationPaths
      return `86'/${coinType}/${walletAccount}'/0/` // BIP86 Taproot path
    default:
      return `84'/${coinType}/${walletAccount}'/0/` // Default to Native SegWit
  }
}

export const getDerivationPaths = (
  walletAccount: number,
  _network: Network,
  pathType: UtxoDerivationPathType = 0
): RootDerivationPaths => {
  const paths: RootDerivationPaths = {
    [Network.Mainnet]: `${getDerivationPath(walletAccount, Network.Mainnet, pathType)}`,
    [Network.Testnet]: `${getDerivationPath(walletAccount, Network.Testnet, pathType)}`,
    [Network.Stagenet]: `${getDerivationPath(walletAccount, Network.Stagenet, pathType)}`
  }
  return paths
}

export const fromLedgerErrorType = (error: number): LedgerErrorId => {
  switch (error) {
    default:
      return LedgerErrorId.UNKNOWN
  }
}
