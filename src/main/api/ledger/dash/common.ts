import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

// BIP44 compliant
export const getDerivationPath = (walletAccount: number, network: Network): string => {
  const DERIVATION_PATHES = {
    [Network.Mainnet]: ['m', "44'", "5''", `${walletAccount}'`, '0/'],
    [Network.Testnet]: ['m', "44'", "5''", `${walletAccount}'`, '0/'],
    [Network.Stagenet]: ['m', "44'", "1'", `${walletAccount}'`, '0/']
  }
  const path = DERIVATION_PATHES[network].join('/')
  return path
}

export const getDerivationPaths = (walletAccount: number, network: Network): RootDerivationPaths => {
  const paths: RootDerivationPaths = {
    [Network.Mainnet]: `${getDerivationPath(walletAccount, network)}`,
    [Network.Testnet]: `${getDerivationPath(walletAccount, network)}`,
    [Network.Stagenet]: `${getDerivationPath(walletAccount, network)}`
  }
  return paths
}
