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
  'transaction.status.outbound.delay': 'Retraso saliente ({time} restante)',
  'transaction.stage.observed': 'Observado',
  'transaction.stage.confirmed': 'Confirmado',
  'transaction.stage.finalised': 'Finalizado',
  'transaction.stage.swapped': 'Intercambiado',
  'transaction.stage.outbound': 'Saliente',
  'transaction.progress.summary': '{completed} de {total} etapas completadas'
}

export default transaction
