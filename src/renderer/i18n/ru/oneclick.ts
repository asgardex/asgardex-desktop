import { OneClickMessages } from '../types'

const oneclick: OneClickMessages = {
  'oneclick.status.refunded': 'Возвращено',
  'oneclick.status.refunded.detail': 'Депозит был возвращён',
  'oneclick.status.failed': 'Ошибка',
  'oneclick.status.failed.detail': 'Обмен не удался',
  'oneclick.status.pending.detail': 'Ожидание обнаружения депозита 1Click...',
  'oneclick.status.knownDeposit': 'Депозит зарегистрирован',
  'oneclick.status.knownDeposit.detail': '1Click подтвердил вашу транзакцию депозита',
  'oneclick.status.pendingDeposit': 'Ожидание подтверждения',
  'oneclick.status.pendingDeposit.detail': 'Ожидание подтверждений сети...',
  'oneclick.status.incomplete': 'Частичный депозит',
  'oneclick.status.incomplete.detail': 'Получено меньше заявленной суммы',
  'oneclick.status.processing': 'Маршрутизация',
  'oneclick.status.processing.detail': 'Солверы выполняют обмен...',
  'oneclick.status.unknown': 'Обработка',
  'oneclick.refunded': 'Возвращено',
  'oneclick.failed': 'Ошибка',
  'oneclick.completed': 'Завершено',
  'oneclick.field.amount': 'Сумма:',
  'oneclick.field.time': 'Время:',
  'oneclick.field.depositAddress': 'Депозит:',
  'oneclick.field.originTx': 'Исходная Tx:',
  'oneclick.field.destinationTx': 'Целевая Tx:',
  'oneclick.field.received': 'Получено:'
}

export default oneclick
