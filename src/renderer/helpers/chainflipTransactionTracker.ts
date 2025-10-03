import { ChainflipTransactionTrackingService } from '../services/chainflip/transactionTracking'

/**
 * Helper function to add a Chainflip swap transaction to the tracker
 */
export const addChainflipSwapToTracker = (
  transactionTrackingService: ChainflipTransactionTrackingService,
  depositChannelId: string,
  swapParams: {
    sourceAsset: string
    targetAsset: string
    amount: string
  }
) => {
  transactionTrackingService.addTransaction({
    depositChannelId,
    startTime: Date.now(),
    fromAsset: swapParams.sourceAsset,
    toAsset: swapParams.targetAsset,
    amount: swapParams.amount
  })
}

/**
 * Helper function to add a Chainflip swap transaction to the tracker from quote details
 */
export const addChainflipSwapToTrackerFromQuote = (
  transactionTrackingService: ChainflipTransactionTrackingService,
  depositChannelId: string,
  quoteParams: {
    srcAsset: { chain: string; symbol: string }
    destAsset: { chain: string; symbol: string }
    depositAmount: string
  }
) => {
  // Format asset strings in the same way as other parts of the app
  const sourceAssetString = `${quoteParams.srcAsset.chain}.${quoteParams.srcAsset.symbol}`
  const targetAssetString = `${quoteParams.destAsset.chain}.${quoteParams.destAsset.symbol}`

  addChainflipSwapToTracker(transactionTrackingService, depositChannelId, {
    sourceAsset: sourceAssetString,
    targetAsset: targetAssetString,
    amount: quoteParams.depositAmount
  })
}

/**
 * Helper function to add a Chainflip swap to tracker from deposit address response
 */
export const addChainflipSwapToTrackerFromDepositAddress = (
  transactionTrackingService: ChainflipTransactionTrackingService,
  depositAddressResponse: {
    depositChannelId: string
    srcAsset: { chain: string; symbol: string }
    destAsset: { chain: string; symbol: string }
    depositAmount?: string
  }
) => {
  const sourceAssetString = `${depositAddressResponse.srcAsset.chain}.${depositAddressResponse.srcAsset.symbol}`
  const targetAssetString = `${depositAddressResponse.destAsset.chain}.${depositAddressResponse.destAsset.symbol}`

  addChainflipSwapToTracker(transactionTrackingService, depositAddressResponse.depositChannelId, {
    sourceAsset: sourceAssetString,
    targetAsset: targetAssetString,
    amount: depositAddressResponse.depositAmount || '0' // Default to 0 if amount not specified
  })
}
