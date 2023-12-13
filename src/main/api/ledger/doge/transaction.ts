import AppBTC from '@ledgerhq/hw-app-btc'
import { Transaction } from '@ledgerhq/hw-app-btc/lib/types'
import Transport from '@ledgerhq/hw-transport'
import { checkFeeBounds, FeeRate, Network, TxHash, UtxoOnlineDataProviders } from '@xchainjs/xchain-client'
import {
  AssetDOGE,
  Client,
  DOGEChain,
  LOWER_FEE_BOUND,
  UPPER_FEE_BOUND,
  defaultDogeParams
} from '@xchainjs/xchain-doge'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { BlockcypherProvider, BlockcypherNetwork } from '@xchainjs/xchain-utxo-providers'
import * as E from 'fp-ts/lib/Either'

import { blockcypherApiKey } from '../../../../shared/api/blockcypher'
import { LedgerError, LedgerErrorId, Network as LedgerNetwork } from '../../../../shared/api/types'
import { toClientNetwork } from '../../../../shared/utils/client'
import { isError } from '../../../../shared/utils/guard'
import { getDerivationPath } from './common'

//======================
// Blockcypher
//======================
const testnetBlockcypherProvider = new BlockcypherProvider(
  'https://api.blockcypher.com/v1',
  DOGEChain,
  AssetDOGE,
  8,
  BlockcypherNetwork.DOGE,
  blockcypherApiKey || ''
)

const mainnetBlockcypherProvider = new BlockcypherProvider(
  'https://api.blockcypher.com/v1',
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

/**
 * Sends DOGE tx using Ledger
 */
export const send = async ({
  transport,
  network,
  sender,
  recipient,
  amount,
  feeRate,
  memo,
  walletIndex
}: {
  transport: Transport
  network: LedgerNetwork
  sender?: Address
  recipient: Address
  amount: BaseAmount
  feeRate: FeeRate
  memo?: string
  walletIndex: number
}): Promise<E.Either<LedgerError, TxHash>> => {
  if (!sender) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: `Getting sender address using Ledger failed`
    })
  }

  try {
    // safety check for fees, similar to handling in `Client.transfer`
    // @see https://github.com/xchainjs/xchainjs-lib/blob/d6752ac3d6f17a0fe8f1755fcc6cd190119e4e23/packages/xchain-doge/src/client.ts#L300
    checkFeeBounds({ lower: LOWER_FEE_BOUND, upper: UPPER_FEE_BOUND }, feeRate)

    // Value of `currency` -> `GetAddressOptions` -> `currency` -> `id`
    // Example https://github.com/LedgerHQ/ledger-live/blob/37c0771329dd5a40dfe3430101bbfb100330f6bd/libs/ledger-live-common/src/families/bitcoin/hw-getAddress.ts#L17
    // DOGE -> `dogecoin` https://github.com/LedgerHQ/ledger-live/blob/37c0771329dd5a40dfe3430101bbfb100330f6bd/libs/ledgerjs/packages/cryptoassets/src/currencies.ts#L834
    const app = new AppBTC({ transport, currency: 'dogecoin' })
    const clientNetwork = toClientNetwork(network)
    const derivePath = getDerivationPath(walletIndex, clientNetwork)

    const dogeInitParams = {
      ...defaultDogeParams,
      network: clientNetwork,
      dataProviders: [BlockcypherDataProviders]
    }

    const dogeClient = new Client(dogeInitParams)

    const { psbt, utxos } = await dogeClient.buildTx({
      amount,
      recipient,
      memo,
      feeRate,
      sender
    })

    const inputs: Array<[Transaction, number, string | null, number | null]> = utxos.map(({ txHex, hash, index }) => {
      if (!txHex) {
        throw Error(`Missing 'txHex' for UTXO (txHash ${hash})`)
      }
      const splittedTx = app.splitTransaction(txHex, false /* no segwit support */)
      return [splittedTx, index, null, null]
    })

    const associatedKeysets: string[] = inputs.map((_) => derivePath)

    const newTxHex = psbt.data.globalMap.unsignedTx.toBuffer().toString('hex')
    const newTx: Transaction = app.splitTransaction(newTxHex, true)

    const outputScriptHex = app.serializeTransactionOutputs(newTx).toString('hex')

    const txHex = await app.createPaymentTransaction({
      inputs,
      associatedKeysets,
      outputScriptHex,
      // no additionals - similar to https://github.com/shapeshift/hdwallet/blob/a61234eb83081a4de54750b8965b873b15803a03/packages/hdwallet-ledger/src/bitcoin.ts#L222
      additionals: []
    })

    const txHash = await dogeClient.broadcastTx(txHex)

    if (!txHash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Post request to send DOGE transaction using Ledger failed`
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
