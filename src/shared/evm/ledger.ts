import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

import { EvmHDMode } from './types'

// ETH derivation pathes `Legacy`, `Ledger Live`, `MetaMask`
// Based on
// - Definitions in LedgerLive https://github.com/LedgerHQ/ledger-live/blob/develop/libs/ledger-live-common/src/derivation.ts#L43-L55
// - Definitions in MetaMask https://github.com/MetaMask/metamask-extension/blob/develop/ui/pages/create-account/connect-hardware/index.js#L24-L31
const DERIVATION_MAP: Record<EvmHDMode, string> = {
  legacy: `m/44'/60'/0'/{walletIndex}`,
  ledgerlive: `m/44'/60'/{walletAccount}'/0/{walletIndex}`,
  metamask: `m/44'/60'/{walletAccount}'/0/{walletIndex}`
}

export const getDerivationPath = (walletAccount: number, walletIndex: number, mode: EvmHDMode): string => {
  return `${DERIVATION_MAP[mode]}`
    .replace('{walletAccount}', walletAccount.toString())
    .replace('{walletIndex}', walletIndex.toString())
}
export const getDerivationPaths = (
  walletAccount: number,
  walletIndex: number,
  mode: EvmHDMode
): RootDerivationPaths => {
  const basePath = getDerivationPath(walletAccount, walletIndex, mode)

  const paths: RootDerivationPaths = {
    [Network.Mainnet]: `${basePath}`,
    [Network.Testnet]: `${basePath}`,
    [Network.Stagenet]: `${basePath}`
  }
  return paths
}
