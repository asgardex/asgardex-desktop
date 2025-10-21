import type Transport from '@ledgerhq/hw-transport'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { ClientLedger, CompatibleAsset, defaultSolanaParams } from '@xchainjs/xchain-solana'
import { Address, AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import { either as E } from 'fp-ts'

import { LedgerError, LedgerErrorId } from '../../../../shared/api/types'
import { isError } from '../../../../shared/utils/guard'
import { getDefaultClientUrls, getDerivationPaths } from './common'

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
  asset: AnyAsset
  recipient: Address
  memo?: string
  walletAccount: number
  walletIndex: number
}): Promise<E.Either<LedgerError, TxHash>> => {
  try {
    const clientLedger = new ClientLedger({
      transport,
      ...defaultSolanaParams,
      clientUrls: getDefaultClientUrls(),
      rootDerivationPaths: getDerivationPaths(walletAccount, network),
      network: network
    })

    const txhash = await clientLedger.transfer({
      walletIndex,
      asset: asset as CompatibleAsset,
      recipient,
      amount,
      memo
    })

    if (!txhash) {
      return E.left({
        errorId: LedgerErrorId.INVALID_RESPONSE,
        msg: `Post request to send SOL transfer failed`
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
