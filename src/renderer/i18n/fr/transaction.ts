import { TransactionMessages } from '../types'

const transaction: TransactionMessages = {
  'transaction.status.complete': 'Terminé',
  'transaction.status.pending': 'En attente',
  'transaction.status.observing': 'Observation',
  'transaction.status.confirming': 'Confirmation ({time} restant)',
  'transaction.status.confirming.simple': 'Confirmation',
  'transaction.status.finalising': 'Finalisation',
  'transaction.status.swapping': 'Échange',
  'transaction.status.streaming': 'Streaming ({current}/{total})',
  'transaction.status.outbound': 'Sortant',
  'transaction.status.outbound.delay': 'Délai sortant ({time} restant)'
}

export default transaction
