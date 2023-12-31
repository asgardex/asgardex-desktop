import * as RD from '@devexperts/remote-data-ts'
import { TxHash, XChainClient } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import * as ETH from '@xchainjs/xchain-evm'
import { Address } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ApiError, ErrorId, TxLD } from '../../wallet/types'
import { TxsPageLD, TxsParams } from '../types'

/**
 * Observable to load txs
 */
export const loadTxs$ = ({
  client,
  asset: oAsset,
  limit,
  offset,
  walletAddress,
  walletIndex
}: {
  client: XChainClient
} & TxsParams): TxsPageLD => {
  // To do, fix filter by assets for avax and bsc
  const txAsset = FP.pipe(
    oAsset,
    O.map((asset) => (asset.chain === ETHChain ? ETH.getTokenAddress(asset) || undefined : undefined)),
    O.toUndefined
  )

  const address = FP.pipe(
    walletAddress,
    /* TODO (@asgdx-team) Make sure we use correct index by introducing HD wallets in the future */
    O.getOrElse(() => client.getAddress(walletIndex))
  )

  return Rx.from(
    client.getTransactions({
      address,
      asset: txAsset,
      limit,
      offset
    })
  ).pipe(
    // Use the tap operator to log the response
    RxOp.map(RD.success),
    RxOp.catchError((error) => {
      console.error('getTransactions error:', error) // Also log the error
      return Rx.of(
        RD.failure<ApiError>({
          errorId: ErrorId.GET_ASSET_TXS,
          msg: error?.message ?? error.toString(),
          // Error code needs to be parsed this way - NOT accessible via `error?.status`
          statusCode: JSON.parse(JSON.stringify(error))?.status
        })
      )
    }),
    RxOp.startWith(RD.pending)
  )
}

/**
 * Observable to load data of a `Tx`
 */
export const loadTx$ = ({
  client,
  txHash,
  assetAddress
}: {
  client: XChainClient
  txHash: TxHash
  assetAddress: O.Option<Address>
}): TxLD =>
  Rx.from(client.getTransactionData(txHash, O.toUndefined(assetAddress))).pipe(
    RxOp.map(RD.success),
    RxOp.catchError((error) =>
      Rx.of(RD.failure<ApiError>({ errorId: ErrorId.GET_TX, msg: error?.message ?? error.toString() }))
    ),
    RxOp.startWith(RD.pending)
  )
