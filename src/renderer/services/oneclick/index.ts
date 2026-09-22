import { createOneClickTransactionTrackingService } from './transactionTracking'

const transactionTrackingService = createOneClickTransactionTrackingService()

export { transactionTrackingService }
export * from './transactionTracking'
export {
  findOneClickToken,
  getAssetsData$,
  getOneClickAssetIconUrl,
  getOneClickUsdPrice,
  isOneClickSupportedAsset,
  ONECLICK_FALLBACK_CHAINS
} from './assets'
