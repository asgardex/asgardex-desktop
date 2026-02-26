import type Transport from '@ledgerhq/hw-transport'
import { FeeRate, Network, TxHash } from '@xchainjs/xchain-client'
import {
  AssetDASH,
  BitgoProviders,
  ClientLedger,
  DASHChain,
  DASH_DECIMAL,
  defaultDashParams
} from '@xchainjs/xchain-dash'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import { either as E } from 'fp-ts'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { removeAffiliate } from '../doge/common'
import { getDerivationPaths } from './common'

/**
 * Sends DASH tx using Ledger
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
  // Block Cypher
  //======================

  const mainnetBlockcypherProvider = new BlockcypherProvider(
    'https://api.blockcypher.com/v1',
    DASHChain,
    AssetDASH,
    DASH_DECIMAL,
    BlockcypherNetwork.DASH,
    apiKey || ''
  )
  const BlockcypherDataProviders: UtxoOnlineDataProviders = {
    [Network.Testnet]: undefined,
    [Network.Stagenet]: mainnetBlockcypherProvider,
    [Network.Mainnet]: mainnetBlockcypherProvider
  }

  try {
    const dashClient = new ClientLedger({
      transport,
      ...defaultDashParams,
      rootDerivationPaths: getDerivationPaths(walletAccount, network),
      dataProviders: [BlockcypherDataProviders, BitgoProviders],
      network: network
    })
    const newMemo = memo !== undefined ? removeAffiliate(memo) : memo // removes affilaite to shorten memo.

    // Ledger's transfer() doesn't accept selectedUtxos/utxoSelectionPreferences — use transferMax() for coin control
    // IPC only sends {hash, index, value} identifiers; re-fetch full UTXOs (with witnessUtxo) from the data provider
    if ((selectedUtxos && selectedUtxos.length > 0) || utxoSelectionPreferences) {
      let fullSelectedUtxos
      if (selectedUtxos && selectedUtxos.length > 0) {
        const allUtxos = await dashClient.getUTXOs(sender)
        const selectedSet = new Set(selectedUtxos.map((u) => `${u.hash}:${u.index}`))
        fullSelectedUtxos = allUtxos.filter((u) => selectedSet.has(`${u.hash}:${u.index}`))
      }

      const result = await dashClient.transferMax({
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
          msg: `Post request to send DASH transaction using Ledger failed`
        })
      }
      return E.right(result.hash)
    }

    const txHash = await dashClient.transfer({
      asset: AssetDASH,
      recipient,
      amount,
      memo: newMemo,
      walletIndex,
      feeRate
    })

    if (!txHash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Post request to send DASH transaction using Ledger failed`
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
