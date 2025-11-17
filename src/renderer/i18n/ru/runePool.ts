import { ProtocolPoolMessages } from '../types'

const protocolPool: ProtocolPoolMessages = {
  // General protocol pool keys
  'protocolPool.detail.title': 'Позиция в Пуле Протокола',
  'protocolPool.detail.availability': 'Пул протокола в настоящее время недоступен',
  'protocolPool.detail.titleDeposit': 'Депозит в Пул Протокола',
  'protocolPool.detail.titleWithdraw': 'Вывод из Пула Протокола',
  'protocolPool.detail.current.title': 'Стоимость депозита',
  'protocolPool.detail.redeem.title': 'Стоимость вывода',
  'protocolPool.detail.percent': 'Рост',
  'protocolPool.detail.totalGrowth': 'Рост в USD',
  'protocolPool.detail.priceGrowth': 'Рост цены',
  'protocolPool.detail.assetAmount': 'Количество активов',
  'protocolPool.detail.daysLeft': 'Дней осталось до возможности вывода',
  'protocolPool.detail.blocksLeft': 'Блоков осталось до возможности вывода',
  'protocolPool.detail.warning': 'Депозит в пул протокола сбросит период вывода',
  'protocolPool.info.max.withdraw.value': 'Максимальная сумма для вывода',
  'protocolPool.info.max.balance': 'Максимальный баланс',
  'protocolPool.add.state.sending': 'Отправка транзакции',
  'protocolPool.add.state.checkResults': 'Проверка результатов транзакции',
  'protocolPool.add.state.pending': 'Добавление в пул',
  'protocolPool.add.state.success': 'Успешное добавление в пул',
  'protocolPool.add.state.error': 'Ошибка при добавлении в пул',
  'protocolPool.withdraw.state.sending': 'Отправка транзакции вывода',
  'protocolPool.withdraw.state.checkResults': 'Проверка результатов транзакции',
  'protocolPool.withdraw.state.pending': 'Вывод из пула',
  'protocolPool.withdraw.state.success': 'Успешный вывод из пула',
  'protocolPool.withdraw.state.error': 'Ошибка при выводе из пула',
  // RUNE specific
  'protocolPool.rune.noAdded': 'Вы не добавили в пул рун',
  'protocolPool.rune.title': 'Позиция в Пуле Рун',
  // CACAO specific
  'protocolPool.cacao.noAdded': 'Вы не добавили в пул какао',
  'protocolPool.cacao.title': 'Позиция в Пуле Какао'
}
export default protocolPool
