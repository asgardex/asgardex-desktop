import { createOneClickTransactionTrackingService } from './transactionTracking'

const transactionTrackingService = createOneClickTransactionTrackingService()

export { transactionTrackingService }
export * from './transactionTracking'
export {
  getAssetsData$,
  getOneClickAssetIconUrl,
  getOneClickUsdPrice,
  isOneClickSupportedAsset,
  ONECLICK_FALLBACK_CHAINS
} from './assets'
