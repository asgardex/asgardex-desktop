import { TransactionMessages } from '../types'

const transaction: TransactionMessages = {
  'transaction.status.complete': 'Completo',
  'transaction.status.pending': 'Pendiente',
  'transaction.status.observing': 'Observando',
  'transaction.status.confirming': 'Confirmando ({time} restante)',
  'transaction.status.confirming.simple': 'Confirmando',
  'transaction.status.finalising': 'Finalizando',
  'transaction.status.swapping': 'Intercambiando',
  'transaction.status.streaming': 'Streaming ({current}/{total})',
  'transaction.status.outbound': 'Saliente',
  'transaction.status.outbound.delay': 'Retraso saliente ({time} restante)'
}

export default transaction
