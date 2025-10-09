import type Transport from '@ledgerhq/hw-transport'
import { Network, TxHash, TxParams } from '@xchainjs/xchain-client'
import { AssetXRP, ClientLedger, defaultXRPParams, XRPTxParams } from '@xchainjs/xchain-ripple'
import { Address, AnyAsset, assetToString, BaseAmount } from '@xchainjs/xchain-util'
import { either as E } from 'fp-ts'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { getDerivationPaths } from './common'

/**
 * Sends XRP tx using Ledger
 */
export const send = async ({
  transport,
  amount,
  asset,
  memo,
  recipient,
  walletAccount,
  walletIndex,
  network,
  destinationTag
}: {
  transport: Transport
  network: Network
  amount: BaseAmount
  asset: AnyAsset
  recipient: Address
  memo?: string
  walletAccount: number
  walletIndex: number
  destinationTag?: number
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    // Only support XRP asset for now
    if (assetToString(asset) !== assetToString(AssetXRP)) {
      throw Error(`Invalid asset ${assetToString(asset)} - Only XRP asset is currently supported to transfer`)
    }

    const clientLedger = new ClientLedger({
      transport,
      ...defaultXRPParams,
      rootDerivationPaths: getDerivationPaths(walletAccount, network),
      network: network
    })

    // Prepare transfer parameters with destination tag support
    const transferParams: TxParams & XRPTxParams = {
      walletIndex,
      asset: AssetXRP,
      recipient,
      amount,
      memo
    }

    // Add destination tag if provided
    if (destinationTag !== undefined) {
      transferParams.destinationTag = destinationTag
    }

    const txHash = await clientLedger.transfer(transferParams)
    if (!txHash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Missing tx hash - broadcasting ${assetToString(asset)} tx failed`
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
