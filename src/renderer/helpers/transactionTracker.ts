import { TransactionTrackingService } from '../services/thorchain/transactionTracking'

/**
 * Helper function to add a swap transaction to the tracker
 */
export const addSwapToTracker = (
  transactionTrackingService: TransactionTrackingService,
  txHash: string,
  swapParams: {
    sourceAsset: string
    targetAsset: string
    amount: string
  }
) => {
  transactionTrackingService.addTransaction({
    txHash,
    startTime: Date.now(),
    fromAsset: swapParams.sourceAsset,
    toAsset: swapParams.targetAsset,
    amount: swapParams.amount
  })
}
