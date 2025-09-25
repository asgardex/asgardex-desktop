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
  'transaction.status.outbound.delay': 'Задержка исходящих ({time} осталось)',
  'transaction.stage.observed': 'Наблюдаемо',
  'transaction.stage.confirmed': 'Подтверждено',
  'transaction.stage.finalised': 'Завершено',
  'transaction.stage.swapped': 'Обменяно',
  'transaction.stage.outbound': 'Исходящий',
  'transaction.progress.summary': '{completed} из {total} этапов завершено'
}

export default transaction
