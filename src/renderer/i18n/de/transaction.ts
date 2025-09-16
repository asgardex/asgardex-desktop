import { TransactionMessages } from '../types'

const transaction: TransactionMessages = {
  'transaction.status.complete': 'Abgeschlossen',
  'transaction.status.pending': 'Ausstehend',
  'transaction.status.observing': 'Beobachtend',
  'transaction.status.confirming': 'Bestätigend ({time} verbleibend)',
  'transaction.status.confirming.simple': 'Bestätigend',
  'transaction.status.finalising': 'Finalisierend',
  'transaction.status.swapping': 'Tauschend',
  'transaction.status.streaming': 'Streaming ({current}/{total})',
  'transaction.status.outbound': 'Ausgehend',
  'transaction.status.outbound.delay': 'Ausgehende Verzögerung ({time} verbleibend)'
}

export default transaction
