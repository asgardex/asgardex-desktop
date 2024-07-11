import type Transport from '@ledgerhq/hw-transport'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { ClientLedger, defaultClientConfig } from '@xchainjs/xchain-thorchain'
import { Address, Asset, BaseAmount } from '@xchainjs/xchain-util'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { getDerivationPaths } from './common'

/**
 * Sends `MsgSend` message using Ledger
 * Note: As long as Ledger THOR app has not been updated, amino encoding/decoding is still used.
 * That's why txs are still broadcasted to `txs` endpoint, which is still supported by THORChain.
 */
export const send = async ({
  transport,
  network,
  asset,
  amount,
  memo,
  recipient,
  walletAccount,
  walletIndex
}: {
  transport: Transport
  amount: BaseAmount
  network: Network
  asset: Asset
  recipient: Address
  memo?: string
  walletAccount: number
  walletIndex: number
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const clientLedger = new ClientLedger({
      transport,
      ...defaultClientConfig,
      rootDerivationPaths: getDerivationPaths(walletAccount, network),
      network: network
    })
    const txhash = await clientLedger.transfer({ walletIndex, asset: asset, recipient, amount, memo })

    if (!txhash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Post request to send 'MsgSend' failed`
      })
    }

    return E.right(txhash)
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.SEND_TX_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}

/**
 * Sends `MsgDeposit` message using Ledger
 * Note: As long as Ledger THOR app has not been updated, amino encoding/decoding is still used.
 * That's why txs are still broadcasted to `txs` endpoint, which is still supported by THORChain.
 */
export const deposit = async ({
  transport,
  network,
  amount,
  asset,
  memo,
  walletAccount,
  walletIndex
}: {
  transport: Transport
  amount: BaseAmount
  asset?: Asset
  network: Network
  memo: string
  walletAccount: number
  walletIndex: number
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const clientLedger = new ClientLedger({
      transport,
      ...defaultClientConfig,
      rootDerivationPaths: getDerivationPaths(walletAccount, network),
      network: network
    })
    const txhash = await clientLedger.deposit({ walletIndex, asset: asset, amount, memo })
    if (!txhash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Post request to send 'MsgDeposit' failed`
      })
    }

    return E.right(txhash)
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.SEND_TX_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}
