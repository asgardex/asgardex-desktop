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
  'transaction.status.outbound.delay': 'Délai sortant ({time} restant)',
  'transaction.stage.observed': 'Observé',
  'transaction.stage.confirmed': 'Confirmé',
  'transaction.stage.finalised': 'Finalisé',
  'transaction.stage.swapped': 'Échangé',
  'transaction.stage.outbound': 'Sortant',
  'transaction.progress.summary': '{completed} sur {total} étapes terminées'
}

export default transaction
