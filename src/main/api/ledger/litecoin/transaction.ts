import type Transport from '@ledgerhq/hw-transport'
import { FeeOption, FeeRate, Network, TxHash } from '@xchainjs/xchain-client'
import { AssetLTC, BitgoProviders, ClientLedger, LTCChain, defaultLtcParams } from '@xchainjs/xchain-litecoin'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import { either as E } from 'fp-ts'

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
  apiKey,
  selectedUtxos,
  utxoSelectionPreferences
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
  selectedUtxos?: Array<{ hash: string; index: number; value: number }>
  utxoSelectionPreferences?: { minimizeFee?: boolean; minimizeInputs?: boolean; consolidateSmallUtxos?: boolean }
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
    const feeRate = fee.rates[feeOption]

    // Ledger's transfer() doesn't accept selectedUtxos/utxoSelectionPreferences — use transferMax() for coin control
    // IPC only sends {hash, index, value} identifiers; re-fetch full UTXOs (with witnessUtxo) from the data provider
    if ((selectedUtxos && selectedUtxos.length > 0) || utxoSelectionPreferences) {
      let fullSelectedUtxos
      if (selectedUtxos && selectedUtxos.length > 0) {
        const allUtxos = await clientLedger.getUTXOs(sender)
        const selectedSet = new Set(selectedUtxos.map((u) => `${u.hash}:${u.index}`))
        fullSelectedUtxos = allUtxos.filter((u) => selectedSet.has(`${u.hash}:${u.index}`))
      }

      const result = await clientLedger.transferMax({
        walletIndex,
        recipient,
        memo,
        feeRate,
        selectedUtxos: fullSelectedUtxos,
        utxoSelectionPreferences
      })
      if (!result?.hash) {
        return E.left({
          errorId: LedgerErrorId.INVALID_RESPONSE,
          msg: `Post request to send LTC transaction using Ledger failed`
        })
      }
      return E.right(result.hash)
    }

    const txHash = await clientLedger.transfer({
      walletIndex,
      asset: AssetLTC,
      recipient,
      amount,
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
    const msg =
      error && typeof error === 'object' && 'getUserFriendlyMessage' in error
        ? (error as { getUserFriendlyMessage: () => string }).getUserFriendlyMessage()
        : isError(error)
          ? (error?.message ?? error.toString())
          : `${error}`
    return E.left({
      errorId: LedgerErrorId.SEND_TX_FAILED,
      msg
    })
  }
}
