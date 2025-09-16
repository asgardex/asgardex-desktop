import { TransactionMessages } from '../types'

const transaction: TransactionMessages = {
  'transaction.status.complete': 'Complete',
  'transaction.status.pending': 'Pending',
  'transaction.status.observing': 'Observing',
  'transaction.status.confirming': 'Confirming ({time} remaining)',
  'transaction.status.confirming.simple': 'Confirming',
  'transaction.status.finalising': 'Finalising',
  'transaction.status.swapping': 'Swapping',
  'transaction.status.streaming': 'Streaming ({current}/{total})',
  'transaction.status.outbound': 'Outbound',
  'transaction.status.outbound.delay': 'Outbound delay ({time} remaining)'
}

export default transaction
