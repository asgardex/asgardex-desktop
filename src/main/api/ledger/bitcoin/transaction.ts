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
import { FeeOption, Network, TxHash } from '@xchainjs/xchain-client'
import { Address, BaseAmount, baseAmount } from '@xchainjs/xchain-util'
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
  feeOption,
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
  feeOption: FeeOption
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

    const fee = await clientLedger.getFeesWithRates({ sender, memo })
    const feeAmount = fee.fees[feeOption]
    const feeRate = fee.rates[feeOption]
    const bal = await clientLedger.getBalance(sender)
    const btcBalance = bal[0]
    const transactionSize = feeAmount.amount().toNumber() / feeRate
    const roundedFeeRate = Math.ceil(feeRate)
    const adjustedFee = baseAmount(roundedFeeRate * transactionSize)
    const feeValue = adjustedFee.amount().toNumber()
    const roundedFeeValue = Math.ceil(feeValue / 1000) * 1000
    let amountToSend: BaseAmount
    if (amount.plus(adjustedFee).gte(btcBalance.amount)) {
      amountToSend = btcBalance.amount.minus(roundedFeeValue)
    } else {
      amountToSend = amount
    }
    const txHash = await clientLedger.transfer({
      walletIndex,
      asset: AssetBTC,
      recipient,
      amount: amountToSend,
      memo,
      feeRate: roundedFeeRate
    })
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
