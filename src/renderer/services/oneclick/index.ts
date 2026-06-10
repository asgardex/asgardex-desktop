import { createOneClickTransactionTrackingService } from './transactionTracking'

const transactionTrackingService = createOneClickTransactionTrackingService()

export { transactionTrackingService }
export * from './transactionTracking'
