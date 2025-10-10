import type Transport from '@ledgerhq/hw-transport'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { ClientLedger, defaultTRONParams } from '@xchainjs/xchain-tron'
import { Address, AnyAsset, Asset, BaseAmount, TokenAsset } from '@xchainjs/xchain-util'
import { either as E } from 'fp-ts'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { getDerivationPaths } from './common'

/**
 * Sends TRON tx using Ledger
 */
export const send = async ({
  asset,
  transport,
  network,
  amount,
  memo,
  recipient,
  walletAccount,
  walletIndex
}: {
  asset: AnyAsset
  transport: Transport
  amount: BaseAmount
  network: Network
  recipient: Address
  memo?: string
  walletAccount: number
  walletIndex: number
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const clientLedger = new ClientLedger({
      ...defaultTRONParams,
      transport,
      rootDerivationPaths: getDerivationPaths(walletAccount, network),
      network: network
    })

    const txHash = await clientLedger.transfer({
      walletIndex,
      asset: asset as Asset | TokenAsset,
      memo,
      amount,
      recipient
    })

    if (!txHash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Could not get transaction hash to send ${asset.symbol} transaction`
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
