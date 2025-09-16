import { assetToString } from '@xchainjs/xchain-util'

import { SwapTxParams } from '../services/chain/types'
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

/**
 * Helper function to add a swap transaction to the tracker from SwapTxParams
 */
export const addSwapToTrackerFromParams = (
  transactionTrackingService: TransactionTrackingService,
  txHash: string,
  swapTxParams: SwapTxParams
) => {
  // Extract target asset string from memo (already a string, no need to convert)
  const targetAssetString = swapTxParams.memo.includes('~')
    ? swapTxParams.memo.split(':')[1]?.split('~')[0] || 'UNKNOWN'
    : swapTxParams.memo.split(':')[1] || 'UNKNOWN'

  addSwapToTracker(transactionTrackingService, txHash, {
    sourceAsset: assetToString(swapTxParams.asset),
    targetAsset: targetAssetString,
    amount: swapTxParams.amount.amount().toString()
  })
}
