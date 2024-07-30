import type Transport from '@ledgerhq/hw-transport'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { AssetATOM, ClientLedger, defaultClientConfig, getDenom } from '@xchainjs/xchain-cosmos'
import { Address, Asset, assetToString, BaseAmount } from '@xchainjs/xchain-util'
import * as E from 'fp-ts/Either'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { getDerivationPaths } from './common'

/**
 * Sends Cosmos tx using Ledger
 */
export const send = async ({
  transport,
  amount,
  asset,
  memo,
  recipient,
  walletAccount,
  walletIndex,
  network
}: {
  transport: Transport
  network: Network
  amount: BaseAmount
  asset: Asset
  feeAmount: BaseAmount
  recipient: Address
  memo?: string
  walletAccount: number
  walletIndex: number
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const denom = getDenom(asset)

    if (!denom)
      throw Error(`Invalid asset ${assetToString(asset)} - Only ATOM asset is currently supported to transfer`)

    const clientLedger = new ClientLedger({
      transport,
      ...defaultClientConfig,
      rootDerivationPaths: getDerivationPaths(walletAccount, network)
    })
    const txHash = await clientLedger.transfer({ walletIndex, asset: AssetATOM, recipient, amount, memo })
    if (!txHash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Missing tx hash - broadcasting ${assetToString(asset)} tx failed - `
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
