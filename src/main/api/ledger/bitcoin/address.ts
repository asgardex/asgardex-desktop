import AppBTC from '@ledgerhq/hw-app-btc'
import type Transport from '@ledgerhq/hw-transport'
import {
  AssetBTC,
  BTCChain,
  ClientLedger,
  blockstreamExplorerProviders,
  defaultBTCParams
} from '@xchainjs/xchain-bitcoin'
import { Network, Network as clientNetwork } from '@xchainjs/xchain-client'
import { UtxoClientParams } from '@xchainjs/xchain-utxo'
import {
  BitgoProvider,
  BlockcypherNetwork,
  BlockcypherProvider,
  HaskoinNetwork,
  HaskoinProvider,
  UtxoOnlineDataProviders
} from '@xchainjs/xchain-utxo-providers'
import * as E from 'fp-ts/Either'

import { blockcypherApiKey } from '../../../../shared/api/blockcypher'
import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { toClientNetwork } from '../../../../shared/utils/client'
import { isError } from '../../../../shared/utils/guard'
import { WalletAddress } from '../../../../shared/wallet/types'
import { VerifyAddressHandler } from '../types'
import { getDerivationPath } from './common'

const testnetHaskoinProvider = new HaskoinProvider(
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
  [clientNetwork.Testnet]: testnetHaskoinProvider,
  [clientNetwork.Stagenet]: mainnetHaskoinProvider,
  [clientNetwork.Mainnet]: mainnetHaskoinProvider
}

//======================
// Bitgo
//======================
const mainnetBitgoProvider = new BitgoProvider({
  baseUrl: 'https://app.bitgo.com',
  chain: BTCChain
})

export const BitgoProviders: UtxoOnlineDataProviders = {
  [clientNetwork.Testnet]: undefined,
  [clientNetwork.Stagenet]: mainnetBitgoProvider,
  [clientNetwork.Mainnet]: mainnetBitgoProvider
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
  [clientNetwork.Testnet]: testnetBlockcypherProvider,
  [clientNetwork.Stagenet]: mainnetBlockcypherProvider,
  [clientNetwork.Mainnet]: mainnetBlockcypherProvider
}

export const verifyAddress: VerifyAddressHandler = async ({ transport, network, walletIndex }) => {
  // Value of `currency` -> `GetAddressOptions` -> `currency` -> `id`
  // Example https://github.com/LedgerHQ/ledger-live/blob/37c0771329dd5a40dfe3430101bbfb100330f6bd/libs/ledger-live-common/src/families/bitcoin/hw-getAddress.ts#L17
  // BTC -> `bitcoin` https://github.com/LedgerHQ/ledger-live/blob/37c0771329dd5a40dfe3430101bbfb100330f6bd/libs/ledgerjs/packages/cryptoassets/src/currencies.ts#L287
  const app = new AppBTC({ transport, currency: 'bitcoin' })
  const clientNetwork = toClientNetwork(network)
  const derivePath = getDerivationPath(walletIndex, clientNetwork)
  const _ = await app.getWalletPublicKey(derivePath, {
    format: 'bech32', // bech32 format with 84' paths
    verify: true // confirm the address on the device
  })
  return true
}

export const getAddress = async (
  transport: Transport,
  network: Network,
  walletIndex: number
): Promise<E.Either<LedgerError, WalletAddress>> => {
  try {
    const btcInitParams: UtxoClientParams = {
      ...defaultBTCParams,
      network: network,
      dataProviders: [BlockcypherDataProviders, HaskoinDataProviders, BitgoProviders],
      explorerProviders: blockstreamExplorerProviders,
      feeBounds: {
        lower: LOWER_FEE_BOUND,
        upper: UPPER_FEE_BOUND
      }
    }
    const clientLedger = new ClientLedger({ transport, ...btcInitParams })
    const address = await clientLedger.getAddressAsync()
    return E.right({ address: address, chain: BTCChain, type: 'ledger', walletIndex, hdMode: 'default' })
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: `Could not get address from Ledger's BTC app: ${
        isError(error) ? error?.message ?? error.toString() : `${error}`
      }`
    })
  }
}
