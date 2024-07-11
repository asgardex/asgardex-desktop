import { AssetBTC, BTCChain, blockstreamExplorerProviders, defaultBTCParams } from '@xchainjs/xchain-bitcoin'
import { Network, RootDerivationPaths } from '@xchainjs/xchain-client'
import { UtxoClientParams } from '@xchainjs/xchain-utxo'
import {
  BitgoProvider,
  BlockcypherNetwork,
  BlockcypherProvider,
  HaskoinNetwork,
  HaskoinProvider,
  UtxoOnlineDataProviders
} from '@xchainjs/xchain-utxo-providers'

import { blockcypherApiKey } from '../../../../shared/api/blockcypher'
import { LedgerErrorId } from '../../../../shared/api/types'

export const getDerivationPath = (walletAccount: number, network: Network): string => {
  const DERIVATION_PATHES = {
    [Network.Mainnet]: ["84'", "0'", `${walletAccount}'`, '0/'],
    [Network.Testnet]: ["84'", "1'", `${walletAccount}'`, '0/'],
    [Network.Stagenet]: ["84'", "0'", `${walletAccount}'`, '0/']
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

export const testnetHaskoinProvider = new HaskoinProvider(
  'https://api.haskoin.com',
  BTCChain,
  AssetBTC,
  8,
  HaskoinNetwork.BTCTEST
)

const LOWER_FEE_BOUND = 1
const UPPER_FEE_BOUND = 2000

const mainnetHaskoinProvider = new HaskoinProvider('https://api.haskoin.com', BTCChain, AssetBTC, 8, HaskoinNetwork.BTC)
const HaskoinDataProviders: UtxoOnlineDataProviders = {
  [Network.Testnet]: testnetHaskoinProvider,
  [Network.Stagenet]: mainnetHaskoinProvider,
  [Network.Mainnet]: mainnetHaskoinProvider
}

//======================
// Bitgo
//======================
const mainnetBitgoProvider = new BitgoProvider({
  baseUrl: 'https://app.bitgo.com',
  chain: BTCChain
})

const BitgoProviders: UtxoOnlineDataProviders = {
  [Network.Testnet]: undefined,
  [Network.Stagenet]: mainnetBitgoProvider,
  [Network.Mainnet]: mainnetBitgoProvider
}

//======================
// Blockcypher
//======================
const testnetBlockcypherProvider = new BlockcypherProvider(
  'https://api.blockcypher.com/v1',
  BTCChain,
  AssetBTC,
  8,
  BlockcypherNetwork.BTCTEST,
  blockcypherApiKey || ''
)

const mainnetBlockcypherProvider = new BlockcypherProvider(
  'https://api.blockcypher.com/v1',
  BTCChain,
  AssetBTC,
  8,
  BlockcypherNetwork.BTC,
  blockcypherApiKey || ''
)
const BlockcypherDataProviders: UtxoOnlineDataProviders = {
  [Network.Testnet]: testnetBlockcypherProvider,
  [Network.Stagenet]: mainnetBlockcypherProvider,
  [Network.Mainnet]: mainnetBlockcypherProvider
}

export const btcInitParams: UtxoClientParams = {
  ...defaultBTCParams,
  dataProviders: [BlockcypherDataProviders, HaskoinDataProviders, BitgoProviders],
  explorerProviders: blockstreamExplorerProviders,
  feeBounds: {
    lower: LOWER_FEE_BOUND,
    upper: UPPER_FEE_BOUND
  }
}
