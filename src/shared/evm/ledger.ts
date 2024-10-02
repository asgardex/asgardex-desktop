import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

import { EvmHDMode } from './types'

// ETH derivation paths `Legacy`, `Ledger Live`, `MetaMask`
// Based on:
// - Definitions in LedgerLive: https://github.com/LedgerHQ/ledger-live/blob/develop/libs/ledger-live-common/src/derivation.ts#L43-L55
// - Definitions in MetaMask: https://github.com/MetaMask/metamask-extension/blob/develop/ui/pages/create-account/connect-hardware/index.js#L24-L31
const DERIVATION_MAP: Record<EvmHDMode, string> = {
  legacy: `m/44'/60'/0'/{walletAccount}`,
  ledgerlive: `m/44'/60'/{walletAccount}'/0/0`,
  metamask: `m/44'/60'/0'/0/{walletAccount}`
}

export const getDerivationPath = (walletAccount: number, mode: EvmHDMode): string => {
  return `${DERIVATION_MAP[mode]}`.replace('{walletAccount}', walletAccount.toString())
}

export const getDerivationPathLedger = (walletAccount: number, mode: EvmHDMode): string => {
  return `${DERIVATION_MAP[mode]}`.replace('{walletAccount}', walletAccount.toString())
}

export const getDerivationPaths = (walletAccount: number, mode: EvmHDMode): RootDerivationPaths => {
  const ledgerPath = getDerivationPathLedger(walletAccount, mode)
  const paths = {
    [Network.Mainnet]: ledgerPath,
    [Network.Testnet]: ledgerPath,
    [Network.Stagenet]: ledgerPath
  }
  return paths
}
