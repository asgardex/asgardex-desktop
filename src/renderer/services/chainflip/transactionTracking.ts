import { SwapSDK, SwapStatusRequest, SwapStatusResponseV2 } from '@chainflip/sdk/swap'
import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { LiveData } from '../../helpers/rx/liveData'
import { triggerStream } from '../../helpers/stateHelper'

// Chainflip-specific status information
export type ChainflipSwapStages = {
  state: SwapStatusResponseV2['state']
  swapId: string
  depositChannelId?: string
  depositAmount?: string
  egressAmount?: string
  fees: Array<{
    type: string
    chain: string
    asset: string
    amount: string
  }>
  depositTxHash?: string
  egressTxHash?: string
  lastUpdate: number
}

export type ChainflipTrackedTransaction = {
  id: string
  depositChannelId: string
  swapId?: string
  startTime: number
  fromAsset: string
  toAsset: string
  amount: string
  stages: ChainflipSwapStages | null
  isComplete: boolean
  completedAt?: number
}

export type ChainflipTransactionTrackingState = {
  transactions: ChainflipTrackedTransaction[]
}

export type ChainflipTransactionTrackingService = {
  addTransaction: (tx: Omit<ChainflipTrackedTransaction, 'id' | 'stages' | 'isComplete' | 'completedAt'>) => void
  removeTransaction: (id: string) => void
  getTransactions$: LiveData<Error, ChainflipTrackedTransaction[]>
  reloadTransactions: () => void
}

export type ChainflipSwapStatusLD = LiveData<Error, SwapStatusResponseV2>

export const createChainflipTransactionTrackingService = (
  swapSDK: SwapSDK,
  completedTransactionRetentionMinutes = 30
): ChainflipTransactionTrackingService => {
  // Internal state
  const transactionsMap = new Map<string, ChainflipTrackedTransaction>()

  // Trigger stream for reloading
  const { stream$: reloadTransactions$, trigger: reloadTransactions } = triggerStream()

  // Generate unique ID for transactions
  const generateId = () => `chainflip_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  // Get swap status from Chainflip SDK
  const getSwapStatus$ = (depositChannelId: string): ChainflipSwapStatusLD => {
    const request: SwapStatusRequest = { id: depositChannelId }

    return Rx.defer(() => swapSDK.getStatusV2(request)).pipe(
      RxOp.map((status) => RD.success(status)),
      RxOp.catchError((error) => {
        console.warn('Chainflip swap status error:', error)
        return Rx.of(RD.failure(new Error(`Failed to get Chainflip swap status: ${error.message}`)))
      }),
      RxOp.shareReplay(1)
    )
  }

  // Map Chainflip status to internal stages format
  const mapChainflipStatusToStages = (status: SwapStatusResponseV2): ChainflipSwapStages => {
    const stages: ChainflipSwapStages = {
      state: status.state,
      swapId: status.swapId,
      depositChannelId: 'depositChannel' in status ? status.depositChannel?.id : undefined,
      depositAmount: 'deposit' in status ? status.deposit?.amount : undefined,
      egressAmount: 'swapEgress' in status ? status.swapEgress?.amount : undefined,
      fees:
        status.fees?.map((fee) => ({
          type: fee.type,
          chain: fee.chain,
          asset: fee.asset,
          amount: fee.amount
        })) || [],
      depositTxHash: 'deposit' in status ? status.deposit?.txRef : undefined,
      egressTxHash: 'swapEgress' in status ? status.swapEgress?.txRef : undefined,
      lastUpdate: status.lastStatechainUpdateAt || Date.now()
    }

    return stages
  }

  // Check if transaction is complete based on Chainflip state
  const isTransactionComplete = (stages: ChainflipSwapStages | null): boolean => {
    if (!stages) return false

    return stages.state === 'COMPLETED'
  }

  // Add a new transaction to track
  const addTransaction = (tx: Omit<ChainflipTrackedTransaction, 'id' | 'stages' | 'isComplete' | 'completedAt'>) => {
    const id = generateId()
    const newTransaction: ChainflipTrackedTransaction = {
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

  // Update transaction with latest stages
  const updateTransactionStages = (id: string, stages: ChainflipSwapStages) => {
    const transaction = transactionsMap.get(id)
    if (transaction) {
      const wasComplete = transaction.isComplete
      const isComplete = isTransactionComplete(stages)

      const updatedTransaction = {
        ...transaction,
        stages,
        isComplete,
        swapId: stages.swapId, // Update swapId from status
        completedAt: !wasComplete && isComplete ? Date.now() : transaction.completedAt
      }
      transactionsMap.set(id, updatedTransaction)

      // Trigger UI update when completion state changes
      if (wasComplete !== isComplete) {
        reloadTransactions()
      }
    }
  }

  // Get polling interval based on transaction state
  const getPollingInterval = (stages: ChainflipSwapStages | null): number => {
    if (!stages) return 10000 // Default 10s for unknown state

    switch (stages.state) {
      case 'WAITING':
        return 15000 // 15s - waiting for deposit
      case 'RECEIVING':
        return 5000 // 5s - processing deposit
      case 'SWAPPING':
        return 3000 // 3s - active swapping
      case 'SENDING':
        return 5000 // 5s - preparing egress
      case 'SENT':
        return 8000 // 8s - waiting for confirmation
      case 'COMPLETED':
      case 'FAILED':
        return -1 // Stop polling
      default:
        return 10000 // Default interval
    }
  }

  // Create a self-rescheduling polling observable for a single transaction
  const createTransactionPoll$ = (tx: ChainflipTrackedTransaction) => {
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
          RxOp.switchMap(() => getSwapStatus$(tx.depositChannelId)),
          RxOp.tap((statusRD) => {
            // Update stages on success
            if (RD.isSuccess(statusRD)) {
              const stages = mapChainflipStatusToStages(statusRD.value)
              updateTransactionStages(tx.id, stages)
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
  const getTransactions$: LiveData<Error, ChainflipTrackedTransaction[]> = FP.pipe(
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
        Rx.merge(...transactionObservables), // Use merge for independent polling
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
