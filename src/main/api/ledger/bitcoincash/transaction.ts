import type Transport from '@ledgerhq/hw-transport'
import { AssetBCH, ClientLedger, defaultBchParams } from '@xchainjs/xchain-bitcoincash'
import { FeeOption, FeeRate, Network, TxHash } from '@xchainjs/xchain-client'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { either as E } from 'fp-ts'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { getDerivationPaths } from './common'

/**
 * Sends BCH tx using Ledger
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
  sendMax,
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
  sendMax?: boolean
  selectedUtxos?: Array<{ hash: string; index: number; value: number }>
  utxoSelectionPreferences?: { minimizeFee?: boolean; minimizeInputs?: boolean; consolidateSmallUtxos?: boolean }
}): Promise<E.Either<LedgerError, TxHash>> => {
  if (!sender) {
    return E.left({
      errorId: LedgerErrorId.GET_ADDRESS_FAILED,
      msg: `Getting sender address using Ledger failed`
    })
  }

  try {
    const clientLedger = new ClientLedger({
      transport,
      ...defaultBchParams,
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
        if (fullSelectedUtxos.length !== selectedUtxos.length) {
          return E.left({
            errorId: LedgerErrorId.INVALID_RESPONSE,
            msg: `Some selected BCH UTXOs are no longer available. Please refresh and retry.`
          })
        }
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
          msg: `Post request to send BCH transaction using Ledger failed`
        })
      }
      return E.right(result.hash)
    }

    // Use transferMax() when sendMax is true (user pressed "Max")
    if (sendMax) {
      const result = await clientLedger.transferMax({
        walletIndex,
        recipient,
        memo,
        feeRate
      })
      if (!result?.hash) {
        return E.left({
          errorId: LedgerErrorId.INVALID_RESPONSE,
          msg: `Post request to send BCH transaction using Ledger failed`
        })
      }
      return E.right(result.hash)
    }

    const txHash = await clientLedger.transfer({
      walletIndex,
      asset: AssetBCH,
      recipient,
      amount,
      memo,
      feeRate
    })
    if (!txHash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Post request to send BCH transaction using Ledger failed`
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
