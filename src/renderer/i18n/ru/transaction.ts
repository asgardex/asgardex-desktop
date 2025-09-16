import { TransactionMessages } from '../types'

const transaction: TransactionMessages = {
  'transaction.status.complete': 'Завершено',
  'transaction.status.pending': 'Ожидание',
  'transaction.status.observing': 'Наблюдение',
  'transaction.status.confirming': 'Подтверждение ({time} осталось)',
  'transaction.status.confirming.simple': 'Подтверждение',
  'transaction.status.finalising': 'Завершение',
  'transaction.status.swapping': 'Обмен',
  'transaction.status.streaming': 'Потоковая передача ({current}/{total})',
  'transaction.status.outbound': 'Исходящий',
  'transaction.status.outbound.delay': 'Задержка исходящих ({time} осталось)'
}

export default transaction
