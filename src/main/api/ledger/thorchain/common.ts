import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

// BIP44 compliant
export const getDerivationPath = (walletAccount: number, network: Network): string => {
  const DERIVATION_PATHS = {
    [Network.Mainnet]: ['m', "44'", "931'", `${walletAccount}'`, '0/'],
    [Network.Testnet]: ['m', "44'", "931'", `${walletAccount}'`, '0/'],
    [Network.Stagenet]: ['m', "44'", "931'", `${walletAccount}'`, '0/']
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
    [Network.Testnet]: ['deprecated'],
    [Network.Stagenet]: ['https://stagenet-rpc.ninerealms.com'],
    [Network.Mainnet]: ['https://rpc.ninerealms.com']
  }
}
