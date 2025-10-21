import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

// BIP44 compliant - Solana uses coin type 501
export const getDerivationPath = (walletAccount: number, network: Network): string => {
  const DERIVATION_PATHS = {
    [Network.Mainnet]: ['m', "44'", "501'", `${walletAccount}'`, '0/'],
    [Network.Testnet]: ['m', "44'", "501'", `${walletAccount}'`, '0/'],
    [Network.Stagenet]: ['m', "44'", "501'", `${walletAccount}'`, '0/']
  }
  const path = DERIVATION_PATHS[network].join('/')
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

export const getDefaultClientUrls = (): Record<Network, string[]> => {
  return {
    [Network.Testnet]: ['https://api.testnet.solana.com'],
    [Network.Stagenet]: ['https://api.devnet.solana.com'],
    [Network.Mainnet]: ['https://api.mainnet-beta.solana.com']
  }
}
