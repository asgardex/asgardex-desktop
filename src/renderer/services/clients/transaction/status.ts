import * as RD from '@devexperts/remote-data-ts'
import { TxHash, XChainClient } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { liveData } from '../../../helpers/rx/liveData'
import { observableState } from '../../../helpers/stateHelper'
import { TxLD } from '../../wallet/types'
import { XChainClient$ } from '../types'
import { loadTx$ } from './common'

/**
 * THOR / MAYA block time ~6s — wait one block before the first getTx so we
 * don't hammer Liquify while the tx can't possibly be indexed yet.
 */
const TX_STATUS_INITIAL_DELAY_THOR_MS = 6_000

/** Default first-poll delay for other chains. */
const TX_STATUS_INITIAL_DELAY_DEFAULT_MS = 10_000

/**
 * Gap between status polls. Was 5s / 50 attempts — too aggressive for shared
 * Liquify RPC when getTx 404s until indexed (xchain then reports
 * "No clients available. Can not retrieve transaction …").
 */
const TX_STATUS_POLL_INTERVAL_MS = 15_000

/** Max poll attempts (~6s + 40×15s ≈ 10 min worst case on THOR). */
const TX_STATUS_MAX_REQUESTS = 40

const initialDelayMsForClient = (client: XChainClient): number => {
  // XChainClient has no getChain(); native asset chain is the client chain
  const chain: Chain = client.getAssetInfo().asset.chain
  if (chain === THORChain || chain === MAYAChain) return TX_STATUS_INITIAL_DELAY_THOR_MS
  return TX_STATUS_INITIAL_DELAY_DEFAULT_MS
}

/**
 * Check if transaction has been included finally.
 *
 * Polls with an initial delay and a gentle interval. Uses `exhaustMap` so a
 * slow `getTransactionData` call is never overlapped by the next tick.
 * Errors are ignored until MAX attempts (tx often not indexed yet).
 *
 * @param txHash Transaction hash
 * @param chain Chain
 */
export const txStatusByClient$ = ({
  client,
  txHash,
  assetAddress
}: {
  client: XChainClient
  txHash: string
  assetAddress: O.Option<Address>
}): TxLD => {
  const MAX = TX_STATUS_MAX_REQUESTS
  const initialDelayMs = initialDelayMsForClient(client)
  // Status to do another poll or not
  const { get$: hasResult$, set: setHasResult } = observableState(false)
  // state of counting request
  const { get$: count$, get: getCount, set: setCount } = observableState(0)
  // Stop after success, or after we've fully used MAX attempts (count goes past MAX)
  const stopInterval$ = Rx.combineLatest([hasResult$, count$]).pipe(
    RxOp.filter(([hasResult, count]) => hasResult || count > MAX)
  )

  return FP.pipe(
    // First emission after one block (THOR/MAYA) / default delay, then every POLL_INTERVAL
    Rx.timer(initialDelayMs, TX_STATUS_POLL_INTERVAL_MS),
    // Run as long as we don't have a valid result or MAX number of requests
    RxOp.takeUntil(stopInterval$),
    // exhaustMap: skip ticks while a previous getTx is still in flight (rate-limit friendly)
    RxOp.exhaustMap(() => {
      setCount(getCount() + 1)
      return loadTx$({ client, txHash, assetAddress })
    }),
    liveData.map((result) => {
      // update state to stop polling
      setHasResult(true)
      return result
    }),
    // As long as we don't reach MAX, accept succeeded result only (ignore not-found / rate errors)
    // After reaching MAX surface the last result including failures
    RxOp.filter((result) => (getCount() < MAX ? RD.isSuccess(result) : true)),
    RxOp.startWith(RD.pending)
  )
}

/**
 * Checks status of a transaction.
 *
 * Polls with initial delay + gentle interval (see TX_STATUS_* constants).
 * Stops on a valid result or after MAX requests.
 *
 * @param txHash Transaction hash
 * @param chain Chain
 */
export const txStatus$: (client$: XChainClient$) => (txHash: TxHash, assetAddres: O.Option<Address>) => TxLD =
  (client$) => (txHash, assetAddress) =>
    client$.pipe(
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => txStatusByClient$({ client, txHash, assetAddress })
          )
        )
      )
    )
