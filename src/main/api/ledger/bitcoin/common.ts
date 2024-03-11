import { AssetBTC, BTCChain, blockstreamExplorerProviders, defaultBTCParams } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
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

// TODO(@veado) Extend`xchain-bitcoin` to get derivation path from it
// Similar to default values in `Client` of `xchain-bitcoin`
// see https://github.com/xchainjs/xchainjs-lib/blob/993c00b8bc4fc2eac302c51da1dc26bb2fa3c7b9/packages/xchain-bitcoin/src/client.ts#L52-L56
export const getDerivationPath = (walletIndex: number, network: Network): string => {
  const DERIVATION_PATHES = {
    [Network.Mainnet]: ["84'", "0'", "0'", 0, walletIndex],
    [Network.Testnet]: ["84'", "1'", "0'", 0, walletIndex],
    [Network.Stagenet]: ["84'", "0'", "0'", 0, walletIndex]
  }
  const path = DERIVATION_PATHES[network].join('/')
  return path
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
