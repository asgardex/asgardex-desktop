import { LedgerMessages } from '../types'

const ledger: LedgerMessages = {
  'ledger.title': 'Ledger',
  'ledger.title.sign': 'Подписать с помощью Ledger',
  'ledger.sign': 'Нажмите "далее" что бы подписать транзакцию на вашем устройстве.',
  'ledger.blindsign':
    '"Данные смарт-контракта" или "слепое подписание" должны быть включены для приложения {chain} на вашем устройстве Ledger.',
  'ledger.needsconnected': 'Убедитесь, что ваш Ledger подключён и приложение {chain} запущено.',
  'ledger.add.device': 'Добавить Ledger',
  'ledger.error.nodevice': 'Нет подключенных устройств',
  'ledger.error.inuse': 'Это устройство используется в другом приложении',
  'ledger.error.appnotopened': 'Приложение Ledger не открыто',
  'ledger.error.noapp':
    'Нет открытых приложений Ledger. Пожалуйста, откройте соответствующее приложение на устройстве.',
  'ledger.error.getaddressfailed': 'Добавление адреса из Ledger не удалось',
  'ledger.error.signfailed': 'Подпись транзакции с помощью Ledger не удалась',
  'ledger.error.sendfailed': 'Отправка транзакции с помощью Ledger не удалась',
  'ledger.error.depositfailed': 'Отправка транзакции добавления средств с помощью Ledger не удалась',
  'ledger.error.invalidpubkey': 'Недействительный открытый ключ для использования Ledger.',
  'ledger.error.invaliddata': 'Неверные данные.',
  'ledger.error.invalidresponse': 'Неверный ответ после отправки транзакции с помощью Ledger.',
  'ledger.error.rejected': 'Действие было отменено на Ledger.',
  'ledger.error.timeout': 'Тайм-аут для обработки действия на Ledger.',
  'ledger.error.notimplemented': 'Действие не было выполнено с Ledger.',
  'ledger.error.denied': 'Вы отклонили запрос Ledger',
  'ledger.error.unknown': 'Неизвестная ошибка',
  'ledger.notsupported': 'Ledger не поддерживает {chain}.',
  'ledger.notaddedorzerobalances': 'Ledger {chain} не была подключена или имеет нулевой баланс.',
  'ledger.deposit.oneside': 'Пока что Ledger поддерживается только для одностороннего добавления активов.',
  'ledger.legacyformat.note': 'Ledger отображает все выходные адреса в формате "legacy", но не в формате "CashAddr".',
  'ledger.legacyformat.show': 'Показать адреса',
  'ledger.legacyformat.hide': 'Скрыть адреса'
}

export default ledger
