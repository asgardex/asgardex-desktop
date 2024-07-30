import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'
import { AssetDOGE, DOGEChain, defaultDogeParams } from '@xchainjs/xchain-doge'
import {
  BitgoProvider,
  BlockcypherNetwork,
  BlockcypherProvider,
  UtxoOnlineDataProviders
} from '@xchainjs/xchain-utxo-providers'

import { blockcypherApiKey, blockcypherUrl } from '../../../../shared/api/blockcypher'
import { LedgerErrorId } from '../../../../shared/api/types'

// TODO(@veado) Extend`xchain-doge` to get derivation path from it
// Similar to default values in `Client` of `xchain-doge`
// see https://github.com/xchainjs/xchainjs-lib/blob/1f892f0cbd95b39df84e5800b0396e487b20c277/packages/xchain-doge/src/client.ts#L50-L54
export const getDerivationPath = (walletAccount: number, network: Network): string => {
  const DERIVATION_PATHES = {
    [Network.Mainnet]: ["44'", "3'", `${walletAccount}'`, '0/'],
    [Network.Testnet]: ["44'", "1'", `${walletAccount}'`, '0/'],
    [Network.Stagenet]: ["44'", "3'", `${walletAccount}'`, '0/']
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

export const fromLedgerErrorType = (error: number): LedgerErrorId => {
  switch (error) {
    default:
      return LedgerErrorId.UNKNOWN
  }
}

const testnetBlockcypherProvider = new BlockcypherProvider(
  blockcypherUrl,
  DOGEChain,
  AssetDOGE,
  8,
  BlockcypherNetwork.DOGE,
  blockcypherApiKey || ''
)
const mainnetBlockcypherProvider = new BlockcypherProvider(
  blockcypherUrl,
  DOGEChain,
  AssetDOGE,
  8,
  BlockcypherNetwork.DOGE,
  blockcypherApiKey || ''
)
const BlockcypherDataProviders: UtxoOnlineDataProviders = {
  [Network.Testnet]: testnetBlockcypherProvider,
  [Network.Stagenet]: mainnetBlockcypherProvider,
  [Network.Mainnet]: mainnetBlockcypherProvider
}
//======================
// Bitgo
//======================
const mainnetBitgoProvider = new BitgoProvider({
  baseUrl: 'https://app.bitgo.com',
  chain: DOGEChain
})

const BitgoProviders: UtxoOnlineDataProviders = {
  [Network.Testnet]: undefined,
  [Network.Stagenet]: mainnetBitgoProvider,
  [Network.Mainnet]: mainnetBitgoProvider
}
export const dogeInitParams = {
  ...defaultDogeParams,
  network: Network,
  dataProviders: [BlockcypherDataProviders, BitgoProviders]
}

/**
 *  Temp function to shorten memo currently doge doesn't like anything over 55 bytes..
 * @param input - memo
 * @returns - memo without the affiliate
 */
export const removeAffiliate = (input: string): string => {
  const affiliate = ':dx:0'
  // Check if the string ends with the specified affiliate
  if (input.endsWith(affiliate)) {
    // Remove the affiliate from the end of the string
    return input.slice(0, input.length - affiliate.length)
  }
  // Return the original string if it does not end with the affiliate
  return input
}
