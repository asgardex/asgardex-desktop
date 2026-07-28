import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'

import { DEFAULT_STORAGES } from '../../../../shared/const'
import { DEFAULT_THORNODE_RPC_URLS, resolveThornodeRpcUrl } from '../../../../shared/thorchain/const'
import { getFileContent } from '../../fileStore'

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

export const getDefaultClientUrls = async (): Promise<Record<Network, string[]>> => {
  const storage = await getFileContent('common', DEFAULT_STORAGES.common)
  const rpcUrls = storage.thornodeRpc ?? DEFAULT_THORNODE_RPC_URLS
  return {
    [Network.Testnet]: [resolveThornodeRpcUrl(rpcUrls.testnet || '')],
    [Network.Stagenet]: [resolveThornodeRpcUrl(rpcUrls.stagenet || '')],
    [Network.Mainnet]: [resolveThornodeRpcUrl(rpcUrls.mainnet || DEFAULT_THORNODE_RPC_URLS.mainnet)]
  }
}
