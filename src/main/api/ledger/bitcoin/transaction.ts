import Transport from '@ledgerhq/hw-transport'
import {
  AddressFormat,
  AssetBTC,
  BTCChain,
  BitgoProviders,
  ClientLedger,
  HaskoinDataProviders,
  defaultBTCParams,
  tapRootDerivationPaths
} from '@xchainjs/xchain-bitcoin'
import { FeeRate, Network, TxHash } from '@xchainjs/xchain-client'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import * as E from 'fp-ts/lib/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { getDerivationPaths } from './common'

/**
 * Sends BTC tx using Ledger
 */
export const send = async ({
  transport,
  network,
  sender,
  recipient,
  feeRate,
  amount,
  memo,
  walletAccount,
  walletIndex,
  addressFormat = AddressFormat.P2WPKH,
  apiKey
}: {
  transport: Transport
  network: Network
  sender?: Address
  recipient: Address
  amount: BaseAmount
  feeRate: FeeRate
  memo?: string
  walletAccount: number
  walletIndex: number
  addressFormat?: AddressFormat
  apiKey: string
}): Promise<E.Either<LedgerError, TxHash>> => {
  if (!sender) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: `Getting sender address using Ledger failed`
    })
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
    apiKey
  )
  const mainnetBlockcypherProvider = new BlockcypherProvider(
    'https://api.blockcypher.com/v1',
    BTCChain,
    AssetBTC,
    8,
    BlockcypherNetwork.BTC,
    apiKey
  )
  const BlockcypherDataProviders: UtxoOnlineDataProviders = {
    [Network.Testnet]: testnetBlockcypherProvider,
    [Network.Stagenet]: mainnetBlockcypherProvider,
    [Network.Mainnet]: mainnetBlockcypherProvider
  }
  try {
    const clientLedger = new ClientLedger({
      transport,
      ...defaultBTCParams,
      dataProviders: [BlockcypherDataProviders, HaskoinDataProviders, BitgoProviders],
      rootDerivationPaths:
        addressFormat === AddressFormat.P2TR ? tapRootDerivationPaths : getDerivationPaths(walletAccount, network),
      network: network
    })
    const txHash = await clientLedger.transfer({ walletIndex, asset: AssetBTC, recipient, amount, memo, feeRate })
    if (!txHash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Post request to send BTC transaction using Ledger failed`
      })
    }
    return E.right(txHash)
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.SEND_TX_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}
