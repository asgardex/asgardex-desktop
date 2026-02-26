import type Transport from '@ledgerhq/hw-transport'
import { FeeRate, Network, TxHash } from '@xchainjs/xchain-client'
import { AssetDOGE, BitgoProviders, ClientLedger, DOGEChain } from '@xchainjs/xchain-doge'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import { either as E } from 'fp-ts'

import { blockcypherUrl } from '../../../../shared/api/blockcypher'
import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { dogeInitParams, getDerivationPaths, removeAffiliate } from './common'

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
  walletAccount,
  walletIndex,
  apiKey,
  sendMax,
  selectedUtxos,
  utxoSelectionPreferences
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
  apiKey: string
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
    const testnetBlockcypherProvider = new BlockcypherProvider(
      blockcypherUrl,
      DOGEChain,
      AssetDOGE,
      8,
      BlockcypherNetwork.DOGE,
      apiKey || ''
    )
    const mainnetBlockcypherProvider = new BlockcypherProvider(
      blockcypherUrl,
      DOGEChain,
      AssetDOGE,
      8,
      BlockcypherNetwork.DOGE,
      apiKey || ''
    )
    const BlockcypherDataProviders: UtxoOnlineDataProviders = {
      [Network.Testnet]: testnetBlockcypherProvider,
      [Network.Stagenet]: mainnetBlockcypherProvider,
      [Network.Mainnet]: mainnetBlockcypherProvider
    }
    const dogeClient = new ClientLedger({
      transport,
      ...dogeInitParams,
      dataProviders: [BlockcypherDataProviders, BitgoProviders],
      rootDerivationPaths: getDerivationPaths(walletAccount, network),
      network: network
    })
    const newMemo = memo !== undefined ? removeAffiliate(memo) : memo // removes affiliate to shorten memo.

    // Ledger's transfer() doesn't accept selectedUtxos/utxoSelectionPreferences — use transferMax() for coin control
    // IPC only sends {hash, index, value} identifiers; re-fetch full UTXOs (with witnessUtxo) from the data provider
    if ((selectedUtxos && selectedUtxos.length > 0) || utxoSelectionPreferences) {
      let fullSelectedUtxos
      if (selectedUtxos && selectedUtxos.length > 0) {
        const allUtxos = await dogeClient.getUTXOs(sender)
        const selectedSet = new Set(selectedUtxos.map((u) => `${u.hash}:${u.index}`))
        fullSelectedUtxos = allUtxos.filter((u) => selectedSet.has(`${u.hash}:${u.index}`))
        if (fullSelectedUtxos.length !== selectedUtxos.length) {
          return E.left({
            errorId: LedgerErrorId.INVALID_RESPONSE,
            msg: `Some selected DOGE UTXOs are no longer available. Please refresh and retry.`
          })
        }
      }

      const result = await dogeClient.transferMax({
        walletIndex,
        recipient,
        memo: newMemo,
        feeRate,
        selectedUtxos: fullSelectedUtxos,
        utxoSelectionPreferences
      })
      if (!result?.hash) {
        return E.left({
          errorId: LedgerErrorId.INVALID_RESPONSE,
          msg: `Post request to send DOGE transaction using Ledger failed`
        })
      }
      return E.right(result.hash)
    }

    // Use transferMax() when sendMax is true (user pressed "Max")
    if (sendMax) {
      const result = await dogeClient.transferMax({
        walletIndex,
        recipient,
        memo: newMemo,
        feeRate
      })
      if (!result?.hash) {
        return E.left({
          errorId: LedgerErrorId.INVALID_RESPONSE,
          msg: `Post request to send DOGE transaction using Ledger failed`
        })
      }
      return E.right(result.hash)
    }

    const txHash = await dogeClient.transfer({
      walletIndex,
      asset: AssetDOGE,
      recipient,
      amount,
      memo: newMemo,
      feeRate
    })

    if (!txHash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Post request to send DOGE transaction using Ledger failed`
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
