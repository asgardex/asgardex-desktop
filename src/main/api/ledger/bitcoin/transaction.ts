import type Transport from '@ledgerhq/hw-transport'
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
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import { either as E } from 'fp-ts'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { HDMode } from '../../../../shared/wallet/types'
import { getDerivationPaths, hdModeToDerivationPathType } from './common'

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
  hdMode,
  addressFormat,
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
  feeOption: FeeOption
  memo?: string
  walletAccount: number
  walletIndex: number
  hdMode?: HDMode
  addressFormat?: AddressFormat
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
    // Determine address format based on hdMode if not explicitly provided
    let finalAddressFormat: AddressFormat = AddressFormat.P2WPKH
    if (addressFormat !== undefined) {
      finalAddressFormat = addressFormat
    } else if (hdMode === 'p2tr') {
      finalAddressFormat = AddressFormat.P2TR
    }

    const clientLedger = new ClientLedger({
      transport,
      ...defaultBTCParams,
      addressFormat: finalAddressFormat,
      dataProviders: [BlockcypherDataProviders, HaskoinDataProviders, BitgoProviders],
      rootDerivationPaths:
        finalAddressFormat === AddressFormat.P2TR
          ? tapRootDerivationPaths
          : getDerivationPaths(walletAccount, network, hdModeToDerivationPathType(hdMode)),
      network: network
    })

    const fee = await clientLedger.getFeesWithRates({ sender, memo })
    const feeRate = fee.rates[feeOption]

    // Ledger's transfer() doesn't accept selectedUtxos — use transferMax() when UTXOs are specified
    // IPC only sends {hash, index, value} identifiers; re-fetch full UTXOs (with witnessUtxo) from the data provider
    if (selectedUtxos && selectedUtxos.length > 0) {
      const allUtxos = await clientLedger.getUTXOs(sender)
      const selectedSet = new Set(selectedUtxos.map((u) => `${u.hash}:${u.index}`))
      const fullSelectedUtxos = allUtxos.filter((u) => selectedSet.has(`${u.hash}:${u.index}`))
      if (fullSelectedUtxos.length !== selectedUtxos.length) {
        return E.left({
          errorId: LedgerErrorId.INVALID_RESPONSE,
          msg: `Some selected BTC UTXOs are no longer available. Please refresh and retry.`
        })
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
          msg: `Post request to send BTC transaction using Ledger failed`
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
        feeRate,
        utxoSelectionPreferences
      })
      if (!result?.hash) {
        return E.left({
          errorId: LedgerErrorId.INVALID_RESPONSE,
          msg: `Post request to send BTC transaction using Ledger failed`
        })
      }
      return E.right(result.hash)
    }

    const txHash = await clientLedger.transfer({
      walletIndex,
      asset: AssetBTC,
      recipient,
      amount,
      memo,
      feeRate,
      utxoSelectionPreferences
    })
    if (!txHash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Post request to send BTC transaction using Ledger failed`
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
