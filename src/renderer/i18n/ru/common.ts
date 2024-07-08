import { CommonMessages } from '../types'

const common: CommonMessages = {
  'common.stats': 'Статистика',
  'common.network': 'Сеть',
  'common.dex': 'Dex',
  'common.faqs': 'ЧаВо',
  'common.greeting': 'Добро пожаловать, {name}',
  'common.copyright': '©',
  'common.type': 'Тип',
  'common.address': 'Адрес',
  'common.addresses': 'Адреса',
  'common.thorname': 'THORName',
  'common.thornameRegistrationSpecifics':
    'THORNames позволяют каждому зарегистрировать кросс-цепочечные адреса кошельков с использованием строки из 1-30 шестнадцатеричных символов, включая специальные символы -+. THORNames ограничены 30 символами, включая ^[a-zA-Z0-9+-]+$.',
  'common.thornameError': 'THORName недоступен',
  'common.mayaname': 'MAYAName',
  'common.owner': 'Владелец',
  'common.preferredAsset': 'Предпочтительный актив',
  'common.expirationBlock': 'блок истечения',
  'common.aliasChain': 'Цепочка псевдонима',
  'common.aliasAddress': 'Адрес псевдонима',
  'common.expiry': 'Срок действия',
  'common.isUpdate': 'Обновить THORName',
  'common.to': 'Получатель',
  'common.from': 'Отправитель',
  'common.filterValue': 'Фильтровать пустые балансы',
  'common.amount': 'Количество',
  'common.address.self': 'Свой',
  'common.coin': 'Монета',
  'common.collapseAll': 'Свернуть все',
  'common.expandAll': 'Развернуть все',
  'common.password': 'Пароль',
  'common.memo': 'Мемо',
  'common.memos': 'Мемо',
  'common.date': 'Дата',
  'common.refresh': 'Обновить',
  'common.back': 'Назад',
  'common.general': 'Основной',
  'common.advanced': 'Продвинутый',
  'common.privateData': 'Личные данные',
  'common.remove': 'Удалить',
  'common.keystore': 'Keystore',
  'common.keystorePassword': 'Пароль Keystore',
  'common.ledger': 'Ledger',
  'common.phrase': 'Фраза',
  'common.submit': 'Отправить',
  'common.confirm': 'Подтвердить',
  'common.cancel': 'Отменить',
  'common.reject': 'Отклонить',
  'common.next': 'Вперед',
  'common.finish': 'Закончить',
  'common.copy': 'Копировать',
  'common.loading': 'Загрузка…',
  'common.error': 'Ошибка',
  'common.error.api.limit': 'Превышен порог запросов API',
  'common.test': 'Тест',
  'common.change': 'Сменить',
  'common.wallet': 'Кошелек',
  'common.history': 'История',
  'common.settings': 'Настройки',
  'common.asset': 'Актив',
  'common.assets': 'Актива(ов)',
  'common.rune': '{dex}',
  'common.pool': 'Пул',
  'common.pool.inbound': 'Вход. пула',
  'common.pools': 'Пулы',
  'common.price': 'Цена',
  'common.price.rune': 'Стоимость RUNE',
  'common.price.cacao': 'Стоимость Cacao',
  'common.transaction': 'Транзакция',
  'common.transaction.short.rune': 'Тр. {dex}',
  'common.transaction.short.asset': 'Тр. актива',
  'common.viewTransaction': 'Посмотреть транзакцию',
  'common.copyTxUrl': 'Скопировать url транзакции',
  'common.trackTransaction': 'Отслеживать транзакцию',
  'common.copyTxHash': 'Скопировать tx hash',
  'common.fee': 'Комиссия',
  'common.feeRate': 'Ставка комиссии',
  'common.fee.nodeOperator': 'Комиссия оператора узла',
  'common.fee.inbound': 'Входящая',
  'common.fee.inbound.rune': 'Вход {dex}',
  'common.fee.inbound.asset': 'Вход актива',
  'common.fee.outbound': 'Исходящая',
  'common.fee.outbound.rune': 'Исх. {dex}',
  'common.fee.outbound.asset': 'исх. актива',
  'common.fee.affiliate': 'Партнёрская',
  'common.fees': 'Комиссии',
  'common.fee.estimated': 'Ориентировочная комиссия',
  'common.fees.estimated': 'Ориентировочные комиссии',
  'common.max': 'Макс.',
  'common.min': 'Мин.',
  'common.search': 'Поиск',
  'common.searchAsset': 'Поиск актива',
  'common.searchExample': 'Пример поиска для не синтетической цепи.ticker, например, btc.btc или для синтетики btc/btc',
  'common.excludeSynth': 'Исключить синтезы',
  'common.retry': 'Повторить',
  'common.reload': 'Обновить',
  'common.action': 'Действие',
  'common.add': 'Добавить',
  'common.completeLp': 'выполнить ЛП',
  'common.swap': 'Обмен',
  'common.savers': 'Сбережения',
  'common.lending': 'Кредитование',
  'common.borrow': 'Занимать',
  'common.repay': 'Погашать',
  'common.earn': 'Заработок',
  'common.liquidity': 'Ликвидность',
  'common.withdraw': 'Вывести',
  'common.approve': 'Подтвердить',
  'common.accept': 'Принять',
  'common.approve.checking': 'Проверяем подтверждение для {asset}',
  'common.approve.error': 'Ошибка проверки подтверждения для {asset}: {error}',
  'common.step': 'Шаг {current}/{total}',
  'common.done': 'Готово',
  'common.nodeAddress': 'Адрес узла',
  'common.providerAddress': 'Адрес провайдера',
  'common.tx.healthCheck': 'Проверка сервера',
  'common.tx.sending': 'Отправка транзакции',
  'common.tx.sendingAsset': 'Отправка транзакции {assetTicker}',
  'common.tx.success': 'Транзакция успешно отправлена',
  'common.tx.success-info':
    'Подтверждение транзакции может занять некоторое время (до нескольких минут в зависимости от цепочки)',
  'common.tx.checkResult': 'Проверка результата',
  'common.tx.view': 'Посмотреть {assetTicker} транзакцию',
  'common.modal.confirmTitle': 'Подтвердите действие',
  'common.value': 'Количество',
  'common.manage': 'Управление Lp',
  'common.managePosition': 'Управление Позицией',
  'common.analytics': 'Аналитика',
  'common.asset.base': 'Базовый',
  'common.asset.change': 'Сменить актив',
  'common.asset.quickSelect': 'Быстрый выбор L1',
  'common.noResult': 'Нет результата',
  'common.rate': 'Курс',
  'common.tx.type.swap': 'Обмен',
  'common.tx.type.donate': 'Донат',
  'common.tx.type.refund': 'Возврат',
  'common.tx.type.deposit': 'Вклад',
  'common.tx.type.withdraw': 'Изъятие',
  'common.detail': 'Подробно',
  'common.details': 'Подробности',
  'common.filter': 'Фильтр',
  'common.all': 'Все',
  'common.time.days': '{days} дней',
  'common.time.days.short': '{days}д',
  'common.time.month1': '1 месяц',
  'common.time.month1.short': '1м',
  'common.time.months3': '3 месяца',
  'common.time.months3.short': '3м',
  'common.time.year1': '1 год',
  'common.time.year1.short': '1г',
  'common.time.all': 'Все',
  'common.time.all.short': 'Все',
  'common.time.title': 'Время',
  'common.inbound.time': 'Входящий',
  'common.outbound.time': 'Исходящий',
  'common.streaming.time': 'Стриминг',
  'common.streaming.time.info': 'Оценочное время для завершения этого стримингового обмена',
  'common.totaltransaction.time': 'Общее время транзакции',
  'common.confirmation.time': '{chain} Подтверждение цепочки',
  'common.theme.light': 'Светлая тема',
  'common.theme.dark': 'Темная тема',
  'common.volume24': 'Количество (24ч)',
  'common.volume24.description': '24ч объём обменов, добавления ликвидности и вывода средств',
  'common.informationMore': 'Больше данных',
  'common.balance': 'Баланс',
  'common.balance.loading': 'Загружаю баланс',
  'common.balances': 'Балансы',
  'common.custom': 'Вручную',
  'common.notsupported.fornetwork': 'Не поддерживается для сети {network}',
  'common.recipient': 'Получатель',
  'common.sender': 'Отправитель',
  'common.legacy': 'Устаревший',
  'common.ledgerlive': 'Ledger Live',
  'common.metamask': 'MetaMask',
  'common.unknown': 'Неизвестен'
}

export default common
