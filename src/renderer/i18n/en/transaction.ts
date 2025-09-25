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
  'transaction.status.outbound.delay': 'Outbound delay ({time} remaining)',
  'transaction.stage.observed': 'Observed',
  'transaction.stage.confirmed': 'Confirmed',
  'transaction.stage.finalised': 'Finalised',
  'transaction.stage.swapped': 'Swapped',
  'transaction.stage.outbound': 'Outbound',
  'transaction.progress.summary': '{completed} of {total} stages complete'
}

export default transaction
