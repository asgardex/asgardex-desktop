import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { LiveData } from '../../helpers/rx/liveData'
import { triggerStream } from '../../helpers/stateHelper'
import { TxStages, TxStagesLD } from './types'

/**
 * Poll cadence for THORNode `GET /thorchain/tx/stages/{hash}` (Liquify-heavy).
 * THOR/MAYA block time is ~6s — polling faster cannot surface new stage data.
 */
export const TX_STAGES_MIN_POLL_MS = 6_000
/** Not yet observed / null stages — back off harder */
export const TX_STAGES_UNKNOWN_POLL_MS = 15_000
/** Active processing / streaming */
export const TX_STAGES_ACTIVE_POLL_MS = 10_000
/** Near completion / quiet stages */
export const TX_STAGES_QUIET_POLL_MS = 12_000
/** After this tracking age, slow incomplete txs further (long streaming / stuck) */
export const TX_STAGES_LONG_RUNNING_AFTER_MS = 30 * 60 * 1000
export const TX_STAGES_LONG_RUNNING_POLL_MS = 30_000
/**
 * Stop polling incomplete txs after this age (keeps last known stages in the UI).
 * 2h covers large streaming swaps without unbounded Liquify spend.
 */
export const TX_STAGES_MAX_INCOMPLETE_MS = 2 * 60 * 60 * 1000

export type TrackedTransaction = {
  id: string
  txHash: string
  startTime: number
  fromAsset: string
  toAsset: string
  amount: string
  stages: TxStages | null
  isComplete: boolean
  completedAt?: number
  /** Set when we stop polling an incomplete tx (max age) — still shown until retention cleanup */
  pollingStopped?: boolean
}

export type TransactionTrackingState = {
  transactions: TrackedTransaction[]
}

export type TransactionTrackingService = {
  addTransaction: (
    tx: Omit<TrackedTransaction, 'id' | 'stages' | 'isComplete' | 'completedAt' | 'pollingStopped'>
  ) => void
  removeTransaction: (id: string) => void
  getTransactions$: LiveData<Error, TrackedTransaction[]>
  reloadTransactions: () => void
}

/** Pure: next delay between stage polls. Exported for unit tests. */
export const getTxStagesPollingInterval = (stages: TxStages | null, trackingAgeMs = 0): number => {
  if (trackingAgeMs >= TX_STAGES_LONG_RUNNING_AFTER_MS) {
    return TX_STAGES_LONG_RUNNING_POLL_MS
  }

  if (!stages) return TX_STAGES_UNKNOWN_POLL_MS

  // Confirmations / outbound delay: one poll per ~block is enough for countdown UI
  if (
    (stages.inboundConfirmationCounted.remainingConfirmationSeconds &&
      stages.inboundConfirmationCounted.remainingConfirmationSeconds > 0) ||
    (stages.outBoundDelay.remainDelaySeconds && stages.outBoundDelay.remainDelaySeconds > 0)
  ) {
    return TX_STAGES_MIN_POLL_MS
  }

  // Streaming sub-swaps
  if (
    stages.swapStatus.streaming.count &&
    stages.swapStatus.streaming.quantity &&
    stages.swapStatus.streaming.count < stages.swapStatus.streaming.quantity
  ) {
    return TX_STAGES_ACTIVE_POLL_MS
  }

  // Pending swap or early inbound stages
  if (stages.swapStatus.pending || !stages.inboundObserved.completed || !stages.inboundFinalised.completed) {
    return TX_STAGES_ACTIVE_POLL_MS
  }

  return TX_STAGES_QUIET_POLL_MS
}

export const isTxStagesComplete = (stages: TxStages | null): boolean => {
  if (!stages) return false

  const basicStagesComplete =
    stages.inboundObserved.completed && stages.inboundFinalised.completed && stages.swapFinalised

  // outboundSigned.completed undefined => no L1 outbound required
  const outboundRequired = stages.outboundSigned.completed !== undefined
  const outboundComplete = outboundRequired ? (stages.outboundSigned.completed ?? false) : true

  const allStagesComplete = basicStagesComplete && outboundComplete

  const noActiveProcessing =
    !stages.swapStatus.pending &&
    (!stages.swapStatus.streaming.count ||
      stages.swapStatus.streaming.count >= (stages.swapStatus.streaming.quantity ?? 1))

  const noRemainingDelays =
    (!stages.inboundConfirmationCounted.remainingConfirmationSeconds ||
      stages.inboundConfirmationCounted.remainingConfirmationSeconds <= 0) &&
    (!stages.outBoundDelay.remainDelaySeconds || stages.outBoundDelay.remainDelaySeconds <= 0)

  return allStagesComplete && noActiveProcessing && noRemainingDelays
}

export const createTransactionTrackingService = (
  getTxStatus$: (txHash: string) => TxStagesLD,
  completedTransactionRetentionMinutes = 30,
  maxIncompleteTrackingMs = TX_STAGES_MAX_INCOMPLETE_MS
): TransactionTrackingService => {
  const transactionsMap = new Map<string, TrackedTransaction>()

  const { stream$: reloadTransactions$, trigger: reloadTransactions } = triggerStream()

  const generateId = () => `tx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  const addTransaction = (
    tx: Omit<TrackedTransaction, 'id' | 'stages' | 'isComplete' | 'completedAt' | 'pollingStopped'>
  ) => {
    const id = generateId()
    const newTransaction: TrackedTransaction = {
      ...tx,
      id,
      stages: null,
      isComplete: false,
      completedAt: undefined,
      pollingStopped: false
    }
    transactionsMap.set(id, newTransaction)
    reloadTransactions()
  }

  const removeTransaction = (id: string) => {
    transactionsMap.delete(id)
    reloadTransactions()
  }

  const updateTransactionStages = (id: string, stages: TxStages) => {
    const transaction = transactionsMap.get(id)
    if (!transaction) return

    const wasComplete = transaction.isComplete
    const isComplete = isTxStagesComplete(stages)

    transactionsMap.set(id, {
      ...transaction,
      stages,
      isComplete,
      completedAt: !wasComplete && isComplete ? Date.now() : transaction.completedAt
    })

    if (wasComplete !== isComplete) {
      reloadTransactions()
    }
  }

  const markPollingStopped = (id: string) => {
    const transaction = transactionsMap.get(id)
    if (!transaction || transaction.pollingStopped) return
    transactionsMap.set(id, { ...transaction, pollingStopped: true })
    reloadTransactions()
  }

  const shouldStopPolling = (tx: TrackedTransaction, now = Date.now()): boolean => {
    if (tx.isComplete || tx.pollingStopped) return true
    if (now - tx.startTime >= maxIncompleteTrackingMs) return true
    return false
  }

  /**
   * One terminal stages fetch (success or failure). Ignores RD.pending/initial so
   * expand does not fork a second poll branch per request.
   */
  const fetchStagesOnce$ = (txHash: string) =>
    getTxStatus$(txHash).pipe(
      RxOp.filter((rd) => RD.isSuccess(rd) || RD.isFailure(rd)),
      RxOp.take(1)
    )

  // Self-rescheduling poller for a single incomplete transaction
  const createTransactionPoll$ = (tx: TrackedTransaction) =>
    FP.pipe(
      // First poll immediately (0 delay)
      Rx.of(0),
      RxOp.expand((delay: number) => {
        const currentTx = transactionsMap.get(tx.id)
        if (!currentTx || shouldStopPolling(currentTx)) {
          if (currentTx && !currentTx.isComplete && !currentTx.pollingStopped) {
            markPollingStopped(tx.id)
          }
          return Rx.EMPTY
        }

        return FP.pipe(
          Rx.timer(delay),
          RxOp.switchMap(() => fetchStagesOnce$(tx.txHash)),
          RxOp.tap((stagesRD) => {
            if (RD.isSuccess(stagesRD)) {
              updateTransactionStages(tx.id, stagesRD.value)
            }
          }),
          RxOp.map(() => {
            const updatedTx = transactionsMap.get(tx.id)
            if (!updatedTx || shouldStopPolling(updatedTx)) {
              if (updatedTx && !updatedTx.isComplete && !updatedTx.pollingStopped) {
                markPollingStopped(tx.id)
              }
              return -1
            }
            const ageMs = Date.now() - updatedTx.startTime
            return getTxStagesPollingInterval(updatedTx.stages, ageMs)
          }),
          RxOp.filter((nextDelay) => nextDelay >= 0)
        )
      }),
      RxOp.map(() => tx.id)
    )

  const getTransactions$: LiveData<Error, TrackedTransaction[]> = FP.pipe(
    reloadTransactions$,
    RxOp.switchMap(() => {
      const transactions = Array.from(transactionsMap.values())

      if (transactions.length === 0) {
        return Rx.of(RD.success([]))
      }

      const transactionObservables = transactions
        .filter((t) => !t.isComplete && !t.pollingStopped)
        .map(createTransactionPoll$)

      if (transactionObservables.length === 0) {
        return Rx.of(RD.success(transactions))
      }

      const manualUpdates$ = reloadTransactions$.pipe(
        RxOp.map(() => Array.from(transactionsMap.values())),
        RxOp.map(RD.success)
      )

      const pollingUpdates$ = FP.pipe(
        Rx.merge(...transactionObservables),
        RxOp.map(() => Array.from(transactionsMap.values())),
        RxOp.map(RD.success),
        RxOp.catchError((error: Error) => Rx.of(RD.failure(error)))
      )

      return Rx.merge(manualUpdates$, pollingUpdates$).pipe(RxOp.startWith(RD.success(transactions)))
    }),
    RxOp.startWith(RD.success([])),
    RxOp.shareReplay(1)
  )

  // Cleanup: drop completed (retention) and long-stopped incomplete rows
  FP.pipe(
    getTransactions$,
    RxOp.debounceTime(5000),
    RxOp.tap((transactionsRD) => {
      if (!RD.isSuccess(transactionsRD)) return

      const now = Date.now()
      const retentionMs = completedTransactionRetentionMinutes * 60 * 1000

      transactionsRD.value.forEach((tx) => {
        if (tx.isComplete) {
          const completionTime = tx.completedAt || tx.startTime
          if (now - completionTime > retentionMs) {
            removeTransaction(tx.id)
          }
          return
        }

        // Incomplete past max age: stop polling if still active, then drop after retention
        if (now - tx.startTime >= maxIncompleteTrackingMs) {
          if (!tx.pollingStopped) {
            markPollingStopped(tx.id)
          } else if (now - tx.startTime > maxIncompleteTrackingMs + retentionMs) {
            removeTransaction(tx.id)
          }
        }
      })
    })
  ).subscribe()

  return {
    addTransaction,
    removeTransaction,
    getTransactions$,
    reloadTransactions
  }
}
