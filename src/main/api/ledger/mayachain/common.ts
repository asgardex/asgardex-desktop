import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

// BIP44 compliant - Mayachain uses coin type 931 (same as Thorchain)
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
    [Network.Testnet]: ['https://tendermint.mayachain.info'],
    [Network.Stagenet]: ['https://stagenet.tendermint.mayachain.info'],
    [Network.Mainnet]: ['https://tendermint.mayachain.info']
  }
}
