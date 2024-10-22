import Transport from '@ledgerhq/hw-transport'
import { FeeRate, Network, TxHash } from '@xchainjs/xchain-client'
import { AssetDOGE, BitgoProviders, ClientLedger, DOGEChain } from '@xchainjs/xchain-doge'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { BlockcypherNetwork, BlockcypherProvider, UtxoOnlineDataProviders } from '@xchainjs/xchain-utxo-providers'
import * as E from 'fp-ts/lib/Either'

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
  apiKey
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
    const newMemo = memo !== undefined ? removeAffiliate(memo) : memo // removes affilaite to shorten memo.

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
    return E.left({
      errorId: LedgerErrorId.SEND_TX_FAILED,
      msg: isError(error) ? error?.message ?? error.toString() : `${error}`
    })
  }
}
