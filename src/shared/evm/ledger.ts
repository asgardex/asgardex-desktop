import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

import { EvmHDMode } from './types'

// ETH derivation paths `Legacy`, `Ledger Live`, `MetaMask`
const DERIVATION_MAP: Record<EvmHDMode, string> = {
  legacy: `m/44'/60'/0'/`,
  ledgerlive: `m/44'/60'/{walletAccount}'/0/`,
  metamask: `m/44'/60'/0'/0/`
}

export const getDerivationPath = (walletAccount: number, mode: EvmHDMode): string => {
  return `${DERIVATION_MAP[mode]}`.replace('{walletAccount}', walletAccount.toString())
}

export const getDerivationPaths = (walletAccount: number, mode: EvmHDMode): RootDerivationPaths => {
  const ledgerPath = getDerivationPath(walletAccount, mode)
  const paths = {
    [Network.Mainnet]: ledgerPath,
    [Network.Testnet]: ledgerPath,
    [Network.Stagenet]: ledgerPath
  }
  return paths
}
