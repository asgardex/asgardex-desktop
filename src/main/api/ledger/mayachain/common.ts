import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

import { DEFAULT_STORAGES } from '../../../../shared/const'
import { DEFAULT_MAYANODE_RPC_URLS } from '../../../../shared/mayachain/const'
import { getFileContent } from '../../fileStore'

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

export const getDefaultClientUrls = async (): Promise<Record<Network, string[]>> => {
  const storage = await getFileContent('common', DEFAULT_STORAGES.common)
  const rpcUrls = storage.mayanodeRpc ?? DEFAULT_MAYANODE_RPC_URLS
  return {
    [Network.Testnet]: [rpcUrls.testnet || DEFAULT_MAYANODE_RPC_URLS.testnet],
    [Network.Stagenet]: [rpcUrls.stagenet || DEFAULT_MAYANODE_RPC_URLS.stagenet],
    [Network.Mainnet]: [rpcUrls.mainnet || DEFAULT_MAYANODE_RPC_URLS.mainnet]
  }
}
