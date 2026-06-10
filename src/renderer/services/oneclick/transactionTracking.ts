import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ASGARDEX_ONECLICK_API_KEY } from '../../../shared/const'
import { logger } from '../../helpers/logger'
import { LiveData } from '../../helpers/rx/liveData'
import { triggerStream } from '../../helpers/stateHelper'

const ONECLICK_STATUS_URL = 'https://1click.chaindefuser.com/v0/status'

// State machine from @defuse-protocol/one-click-sdk-typescript.
// SUCCESS / REFUNDED / FAILED are terminal — we stop polling on those.
export type OneClickStatusState =
  | 'KNOWN_DEPOSIT_TX'
  | 'PENDING_DEPOSIT'
  | 'INCOMPLETE_DEPOSIT'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'REFUNDED'
  | 'FAILED'

export type OneClickTransactionDetails = {
  hash: string
  explorerUrl: string
}

export type OneClickStatusResponse = {
  correlationId?: string
  status: OneClickStatusState
  updatedAt?: string
  swapDetails?: {
    nearTxHashes?: string[]
    amountIn?: string
    amountInFormatted?: string
    amountInUsd?: string
    amountOut?: string
    amountOutFormatted?: string
    amountOutUsd?: string
    slippage?: number
    originChainTxHashes?: OneClickTransactionDetails[]
    destinationChainTxHashes?: OneClickTransactionDetails[]
    refundedAmount?: string
    refundReason?: string
    depositedAmount?: string
    withdrawFee?: string
  }
}

export type OneClickSwapStages = {
  state: OneClickStatusState
  depositAddress: string
  depositedAmount?: string
  amountOut?: string
  amountOutUsd?: string
  originTxHash?: string
  destinationTxHash?: string
  destinationExplorerUrl?: string
  refundReason?: string
  lastUpdate: number
}

export type OneClickTrackedTransaction = {
  id: string
  depositAddress: string
  startTime: number
  fromAsset: string
  toAsset: string
  amount: string
  stages: OneClickSwapStages | null
  isComplete: boolean
  completedAt?: number
}

export type OneClickTransactionTrackingService = {
  addTransaction: (tx: Omit<OneClickTrackedTransaction, 'id' | 'stages' | 'isComplete' | 'completedAt'>) => void
  removeTransaction: (id: string) => void
  getTransactions$: LiveData<Error, OneClickTrackedTransaction[]>
  reloadTransactions: () => void
}

export type OneClickStatusLD = LiveData<Error, OneClickStatusResponse>

const fetchStatus = async (depositAddress: string): Promise<OneClickStatusResponse> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ASGARDEX_ONECLICK_API_KEY) headers['Authorization'] = `Bearer ${ASGARDEX_ONECLICK_API_KEY}`
  const url = `${ONECLICK_STATUS_URL}?depositAddress=${encodeURIComponent(depositAddress)}`
  const resp = await fetch(url, { headers })
  // 404 = deposit not yet seen by 1Click's backend (common right after broadcast).
  // Treat it as "still waiting" rather than a hard error so the tracker keeps polling.
  if (resp.status === 404) {
    return { status: 'KNOWN_DEPOSIT_TX' }
  }
  if (!resp.ok) throw new Error(`1Click status failed: ${resp.status} ${resp.statusText}`)
  return resp.json()
}

export const createOneClickTransactionTrackingService = (
  completedTransactionRetentionMinutes = 30
): OneClickTransactionTrackingService => {
  const transactionsMap = new Map<string, OneClickTrackedTransaction>()
  const { stream$: reloadTransactions$, trigger: reloadTransactions } = triggerStream()

  const generateId = () => `oneclick_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  const getStatus$ = (depositAddress: string): OneClickStatusLD =>
    Rx.defer(() => fetchStatus(depositAddress)).pipe(
      RxOp.map((status) => RD.success(status)),
      RxOp.catchError((error) => {
        logger.warn('1Click status error:', error)
        return Rx.of(RD.failure(new Error(`Failed to get 1Click status: ${error.message ?? String(error)}`)))
      }),
      RxOp.shareReplay(1)
    )

  const mapStatusToStages = (depositAddress: string, status: OneClickStatusResponse): OneClickSwapStages => {
    const origin = status.swapDetails?.originChainTxHashes?.[0]
    const dest = status.swapDetails?.destinationChainTxHashes?.[0]
    return {
      state: status.status,
      depositAddress,
      depositedAmount: status.swapDetails?.depositedAmount,
      amountOut: status.swapDetails?.amountOut,
      amountOutUsd: status.swapDetails?.amountOutUsd,
      originTxHash: origin?.hash,
      destinationTxHash: dest?.hash,
      destinationExplorerUrl: dest?.explorerUrl,
      refundReason: status.swapDetails?.refundReason,
      lastUpdate: status.updatedAt ? Date.parse(status.updatedAt) || Date.now() : Date.now()
    }
  }

  const isTransactionComplete = (stages: OneClickSwapStages | null): boolean => {
    if (!stages) return false
    return stages.state === 'SUCCESS' || stages.state === 'REFUNDED' || stages.state === 'FAILED'
  }

  const addTransaction = (tx: Omit<OneClickTrackedTransaction, 'id' | 'stages' | 'isComplete' | 'completedAt'>) => {
    const id = generateId()
    transactionsMap.set(id, { ...tx, id, stages: null, isComplete: false, completedAt: undefined })
    reloadTransactions()
  }

  const removeTransaction = (id: string) => {
    transactionsMap.delete(id)
    reloadTransactions()
  }

  const updateTransactionStages = (id: string, stages: OneClickSwapStages) => {
    const transaction = transactionsMap.get(id)
    if (!transaction) return
    const wasComplete = transaction.isComplete
    const isComplete = isTransactionComplete(stages)
    transactionsMap.set(id, {
      ...transaction,
      stages,
      isComplete,
      completedAt: !wasComplete && isComplete ? Date.now() : transaction.completedAt
    })
    if (wasComplete !== isComplete) reloadTransactions()
  }

  // Polling cadence: tight while routing, slack while waiting for chain confirms.
  const getPollingInterval = (stages: OneClickSwapStages | null): number => {
    if (!stages) return 10000
    switch (stages.state) {
      case 'KNOWN_DEPOSIT_TX':
        return 10000
      case 'PENDING_DEPOSIT':
      case 'INCOMPLETE_DEPOSIT':
        return 15000
      case 'PROCESSING':
        return 3000
      case 'SUCCESS':
      case 'REFUNDED':
      case 'FAILED':
        return -1
      default:
        return 10000
    }
  }

  const createTransactionPoll$ = (tx: OneClickTrackedTransaction) =>
    FP.pipe(
      Rx.of(0),
      RxOp.expand((delay: number) => {
        const currentTx = transactionsMap.get(tx.id)
        if (!currentTx || currentTx.isComplete) return Rx.EMPTY
        return FP.pipe(
          Rx.timer(delay),
          RxOp.switchMap(() => getStatus$(tx.depositAddress)),
          RxOp.tap((statusRD) => {
            if (RD.isSuccess(statusRD)) {
              const stages = mapStatusToStages(tx.depositAddress, statusRD.value)
              updateTransactionStages(tx.id, stages)
            }
          }),
          RxOp.map(() => {
            const updatedTx = transactionsMap.get(tx.id)
            if (!updatedTx || updatedTx.isComplete) return -1
            return getPollingInterval(updatedTx.stages)
          }),
          RxOp.filter((nextDelay) => nextDelay >= 0)
        )
      }),
      RxOp.map(() => tx.id)
    )

  const getTransactions$: LiveData<Error, OneClickTrackedTransaction[]> = FP.pipe(
    reloadTransactions$,
    RxOp.switchMap(() => {
      const transactions = Array.from(transactionsMap.values())
      if (transactions.length === 0) return Rx.of(RD.success([]))

      const polls = transactions.filter((tx) => !tx.isComplete).map(createTransactionPoll$)
      if (polls.length === 0) return Rx.of(RD.success(transactions))

      const manualUpdates$ = reloadTransactions$.pipe(
        RxOp.map(() => Array.from(transactionsMap.values())),
        RxOp.map(RD.success)
      )
      const pollingUpdates$ = FP.pipe(
        Rx.merge(...polls),
        RxOp.map(() => Array.from(transactionsMap.values())),
        RxOp.map(RD.success),
        RxOp.catchError((error: Error) => Rx.of(RD.failure(error)))
      )

      return Rx.merge(manualUpdates$, pollingUpdates$).pipe(RxOp.startWith(RD.success(transactions)))
    }),
    RxOp.startWith(RD.success([])),
    RxOp.shareReplay(1)
  )

  // Auto-cleanup completed entries so the tracker UI doesn't accumulate stale rows.
  FP.pipe(
    getTransactions$,
    RxOp.debounceTime(5000),
    RxOp.tap((rd) => {
      if (!RD.isSuccess(rd)) return
      const now = Date.now()
      const retentionMs = completedTransactionRetentionMinutes * 60 * 1000
      rd.value.forEach((tx) => {
        const completionTime = tx.completedAt || tx.startTime
        if (tx.isComplete && now - completionTime > retentionMs) removeTransaction(tx.id)
      })
    })
  ).subscribe()

  return { addTransaction, removeTransaction, getTransactions$, reloadTransactions }
}
