import Transport from '@ledgerhq/hw-transport'
import { FeeOption, FeeRate, Network, TxHash } from '@xchainjs/xchain-client'
import { AssetLTC, BitgoProviders, ClientLedger, LTCChain, defaultLtcParams } from '@xchainjs/xchain-litecoin'
import { Address, BaseAmount, baseAmount } from '@xchainjs/xchain-util'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import * as E from 'fp-ts/lib/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { getDerivationPaths } from './common'
/**
 * Sends LTC tx using Ledger
 */
export const send = async ({
  transport,
  network,
  sender,
  recipient,
  amount,
  feeOption,
  memo,
  walletAccount,
  walletIndex,
  apiKey
}: {
  transport: Transport
  network: Network
  sender?: Address
  recipient: Address
  amount: BaseAmount
  feeOption: FeeOption
  feeRate: FeeRate
  memo?: string
  walletAccount: number
  walletIndex: number
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
    LTCChain,
    AssetLTC,
    8,
    BlockcypherNetwork.LTC,
    apiKey || ''
  )

  const mainnetBlockcypherProvider = new BlockcypherProvider(
    'https://api.blockcypher.com/v1',
    LTCChain,
    AssetLTC,
    8,
    BlockcypherNetwork.LTC,
    apiKey || ''
  )
  const BlockcypherDataProviders: UtxoOnlineDataProviders = {
    [Network.Testnet]: testnetBlockcypherProvider,
    [Network.Stagenet]: mainnetBlockcypherProvider,
    [Network.Mainnet]: mainnetBlockcypherProvider
  }

  try {
    const clientLedger = new ClientLedger({
      transport,
      ...defaultLtcParams,
      dataProviders: [BlockcypherDataProviders, BitgoProviders],
      rootDerivationPaths: getDerivationPaths(walletAccount, network),
      network: network
    })

    const fee = await clientLedger.getFeesWithRates({ sender, memo })
    const feeAmount = fee.fees[feeOption]
    const feeRate = fee.rates[feeOption]
    const bal = await clientLedger.getBalance(sender)
    const ltcBalance = bal[0]
    const transactionSize = feeAmount.amount().toNumber() / feeRate
    const roundedFeeRate = Math.ceil(feeRate)
    const adjustedFee = baseAmount(roundedFeeRate * transactionSize)
    const feeValue = adjustedFee.amount().toNumber()
    const roundedFeeValue = Math.ceil(feeValue / 1000) * 1000
    let amountToSend: BaseAmount
    if (amount.plus(adjustedFee).gte(ltcBalance.amount)) {
      amountToSend = ltcBalance.amount.minus(roundedFeeValue)
    } else {
      amountToSend = amount
    }
    const txHash = await clientLedger.transfer({
      walletIndex,
      asset: AssetLTC,
      recipient,
      amount: amountToSend,
      memo,
      feeRate
    })
    if (!txHash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Post request to send LTC transaction using Ledger failed`
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
