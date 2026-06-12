import { createOneClickTransactionTrackingService } from './transactionTracking'

const transactionTrackingService = createOneClickTransactionTrackingService()

export { transactionTrackingService }
export * from './transactionTracking'
export { getAssetsData$, getOneClickUsdPrice, isOneClickSupportedAsset, ONECLICK_FALLBACK_CHAINS } from './assets'
