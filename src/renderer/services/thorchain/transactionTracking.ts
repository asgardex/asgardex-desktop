import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { LiveData } from '../../helpers/rx/liveData'
import { triggerStream } from '../../helpers/stateHelper'
import { TxStages, TxStagesLD } from './types'

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
}

export type TransactionTrackingState = {
  transactions: TrackedTransaction[]
}

export type TransactionTrackingService = {
  addTransaction: (tx: Omit<TrackedTransaction, 'id' | 'stages' | 'isComplete' | 'completedAt'>) => void
  removeTransaction: (id: string) => void
  getTransactions$: LiveData<Error, TrackedTransaction[]>
  reloadTransactions: () => void
}

export const createTransactionTrackingService = (
  getTxStatus$: (txHash: string) => TxStagesLD,
  completedTransactionRetentionMinutes = 30
): TransactionTrackingService => {
  // Internal state
  const transactionsMap = new Map<string, TrackedTransaction>()

  // Trigger stream for reloading
  const { stream$: reloadTransactions$, trigger: reloadTransactions } = triggerStream()

  // Generate unique ID for transactions
  const generateId = () => `tx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  // Add a new transaction to track
  const addTransaction = (tx: Omit<TrackedTransaction, 'id' | 'stages' | 'isComplete' | 'completedAt'>) => {
    const id = generateId()
    const newTransaction: TrackedTransaction = {
      ...tx,
      id,
      stages: null,
      isComplete: false,
      completedAt: undefined
    }
    transactionsMap.set(id, newTransaction)
    reloadTransactions()
  }

  // Remove a transaction from tracking
  const removeTransaction = (id: string) => {
    transactionsMap.delete(id)
    reloadTransactions()
  }

  // Check if transaction is complete based on stages
  const isTransactionComplete = (stages: TxStages | null): boolean => {
    if (!stages) return false

    // More comprehensive completion check
    const basicStagesComplete =
      stages.inboundObserved.completed && stages.inboundFinalised.completed && stages.swapFinalised

    // Check if outbound is required - if outboundSigned.completed is undefined,
    // it means this is not an L1 swap and no outbound transaction is needed
    const outboundRequired = stages.outboundSigned.completed !== undefined
    const outboundComplete = outboundRequired ? stages.outboundSigned.completed ?? false : true

    const allStagesComplete = basicStagesComplete && outboundComplete

    // Additional checks for truly final state
    const noActiveProcessing =
      !stages.swapStatus.pending &&
      (!stages.swapStatus.streaming.count ||
        stages.swapStatus.streaming.count >= (stages.swapStatus.streaming.quantity ?? 1))

    // No remaining delays or confirmations
    const noRemainingDelays =
      (!stages.inboundConfirmationCounted.remainingConfirmationSeconds ||
        stages.inboundConfirmationCounted.remainingConfirmationSeconds <= 0) &&
      (!stages.outBoundDelay.remainDelaySeconds || stages.outBoundDelay.remainDelaySeconds <= 0)

    const isComplete = allStagesComplete && noActiveProcessing && noRemainingDelays

    return isComplete
  }

  // Update transaction with latest stages
  const updateTransactionStages = (id: string, stages: TxStages) => {
    const transaction = transactionsMap.get(id)
    if (transaction) {
      const wasComplete = transaction.isComplete
      const isComplete = isTransactionComplete(stages)

      const updatedTransaction = {
        ...transaction,
        stages,
        isComplete,
        // Set completedAt timestamp when transaction first becomes complete
        completedAt: !wasComplete && isComplete ? Date.now() : transaction.completedAt
      }
      transactionsMap.set(id, updatedTransaction)

      // Trigger UI update only when completion state changes
      if (wasComplete !== isComplete) {
        reloadTransactions()
      }
    }
  }

  // Get dynamic polling interval based on transaction stage
  const getPollingInterval = (stages: TxStages | null): number => {
    if (!stages) return 10000 // Default 10s for unknown state

    // Fast polling during active confirmation counting
    if (
      stages.inboundConfirmationCounted.remainingConfirmationSeconds &&
      stages.inboundConfirmationCounted.remainingConfirmationSeconds > 0
    ) {
      return 2000 // 2s - confirmation countdown
    }

    // Fast polling during outbound delay countdown
    if (stages.outBoundDelay.remainDelaySeconds && stages.outBoundDelay.remainDelaySeconds > 0) {
      return 3000 // 3s - delay countdown
    }

    // Medium polling during streaming swaps
    if (
      stages.swapStatus.streaming.count &&
      stages.swapStatus.streaming.quantity &&
      stages.swapStatus.streaming.count < stages.swapStatus.streaming.quantity
    ) {
      return 5000 // 5s - streaming progress
    }

    // Medium polling for pending swaps or early stages
    if (stages.swapStatus.pending || !stages.inboundObserved.completed || !stages.inboundFinalised.completed) {
      return 5000 // 5s - active processing
    }

    // Slow polling for final stages
    return 8000 // 8s - near completion
  }

  // Create a self-rescheduling polling observable for a single transaction
  const createTransactionPoll$ = (tx: TrackedTransaction) => {
    return FP.pipe(
      // Start with immediate poll (0 delay)
      Rx.of(0),
      RxOp.expand((delay: number) => {
        // Read the latest transaction from the map
        const currentTx = transactionsMap.get(tx.id)

        // Stop if transaction is missing or complete
        if (!currentTx || currentTx.isComplete) {
          return Rx.EMPTY // Complete the stream
        }

        return FP.pipe(
          // Delay by the computed interval (0 for first emission)
          Rx.timer(delay),
          RxOp.switchMap(() => getTxStatus$(tx.txHash)),
          RxOp.tap((stagesRD) => {
            // Update stages on success
            if (RD.isSuccess(stagesRD)) {
              updateTransactionStages(tx.id, stagesRD.value)
            }
          }),
          RxOp.map(() => {
            // Read the updated transaction and compute next interval
            const updatedTx = transactionsMap.get(tx.id)
            if (!updatedTx || updatedTx.isComplete) {
              return -1 // Signal to complete in next expand iteration
            }
            return getPollingInterval(updatedTx.stages)
          }),
          RxOp.filter((nextDelay) => nextDelay >= 0) // Filter out completion signals
        )
      }),
      RxOp.map(() => tx.id) // Return ID for combination
    )
  }

  // Observable that polls all tracked transactions with dynamic intervals
  const getTransactions$: LiveData<Error, TrackedTransaction[]> = FP.pipe(
    reloadTransactions$,
    RxOp.switchMap(() => {
      const transactions = Array.from(transactionsMap.values())

      if (transactions.length === 0) {
        return Rx.of(RD.success([]))
      }

      // Create dynamic polling observables for each active transaction
      const transactionObservables = transactions.filter((tx) => !tx.isComplete).map(createTransactionPoll$)

      if (transactionObservables.length === 0) {
        return Rx.of(RD.success(transactions))
      }

      // Combine all transaction status polls + manual updates
      const manualUpdates$ = reloadTransactions$.pipe(
        RxOp.map(() => Array.from(transactionsMap.values())),
        RxOp.map(RD.success)
      )

      const pollingUpdates$ = FP.pipe(
        Rx.merge(...transactionObservables), // Use merge instead of combineLatest for independent polling
        RxOp.map(() => Array.from(transactionsMap.values())),
        RxOp.map(RD.success),
        RxOp.catchError((error: Error) => Rx.of(RD.failure(error)))
      )

      return Rx.merge(manualUpdates$, pollingUpdates$).pipe(RxOp.startWith(RD.success(transactions)))
    }),
    RxOp.startWith(RD.success([])),
    RxOp.shareReplay(1)
  )

  // Auto-cleanup completed transactions after configured retention time
  FP.pipe(
    getTransactions$,
    RxOp.debounceTime(5000), // Debounce to avoid excessive cleanup
    RxOp.tap((transactionsRD) => {
      if (RD.isSuccess(transactionsRD)) {
        const now = Date.now()
        const retentionMs = completedTransactionRetentionMinutes * 60 * 1000

        transactionsRD.value.forEach((tx) => {
          // Use completedAt timestamp if available, otherwise fall back to startTime
          const completionTime = tx.completedAt || tx.startTime
          if (tx.isComplete && now - completionTime > retentionMs) {
            removeTransaction(tx.id)
          }
        })
      }
    })
  ).subscribe() // Subscribe to activate the cleanup

  return {
    addTransaction,
    removeTransaction,
    getTransactions$,
    reloadTransactions
  }
}
