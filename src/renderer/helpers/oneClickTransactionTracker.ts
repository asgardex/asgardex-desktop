import { OneClickTransactionTrackingService } from '../services/oneclick/transactionTracking'

export const addOneClickSwapToTracker = (
  transactionTrackingService: OneClickTransactionTrackingService,
  depositAddress: string,
  swapParams: {
    sourceAsset: string
    targetAsset: string
    amount: string
  }
) => {
  transactionTrackingService.addTransaction({
    depositAddress,
    startTime: Date.now(),
    fromAsset: swapParams.sourceAsset,
    toAsset: swapParams.targetAsset,
    amount: swapParams.amount
  })
}

export const addOneClickSwapToTrackerFromQuote = (
  transactionTrackingService: OneClickTransactionTrackingService,
  depositAddress: string,
  quoteParams: {
    srcAsset: { chain: string; symbol: string }
    destAsset: { chain: string; symbol: string }
    depositAmount: string
  }
) => {
  const sourceAssetString = `${quoteParams.srcAsset.chain}.${quoteParams.srcAsset.symbol}`
  const targetAssetString = `${quoteParams.destAsset.chain}.${quoteParams.destAsset.symbol}`
  addOneClickSwapToTracker(transactionTrackingService, depositAddress, {
    sourceAsset: sourceAssetString,
    targetAsset: targetAssetString,
    amount: quoteParams.depositAmount
  })
}
