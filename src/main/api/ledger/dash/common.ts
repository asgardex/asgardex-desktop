import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

// BIP44 compliant
export const getDerivationPath = (walletAccount: number, walletIndex: number, network: Network): string => {
  const DERIVATION_PATHES = {
    [Network.Mainnet]: ['m', "44'", "5''", `${walletAccount}'`, 0, walletIndex],
    [Network.Testnet]: ['m', "44'", "5''", `${walletAccount}'`, 0, walletIndex],
    [Network.Stagenet]: ['m', "44'", "1'", `${walletAccount}'`, 0, walletIndex]
  }
  const path = DERIVATION_PATHES[network].join('/')
  return path
}

export const getDerivationPaths = (
  walletAccount: number,
  walletIndex: number,
  network: Network
): RootDerivationPaths => {
  const paths: RootDerivationPaths = {
    [Network.Mainnet]: `${getDerivationPath(walletAccount, walletIndex, network)}`,
    [Network.Testnet]: `${getDerivationPath(walletAccount, walletIndex, network)}`,
    [Network.Stagenet]: `${getDerivationPath(walletAccount, walletIndex, network)}`
  }
  return paths
}
