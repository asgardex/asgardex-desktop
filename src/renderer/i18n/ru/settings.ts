import { SettingMessages } from '../types'

const settings: SettingMessages = {
  'setting.app.title': 'Глобальные настройки',
  'setting.wallet.title': 'Настройки кошелька',
  'setting.wallet.management': 'Управление кошельком',
  'setting.multiwallet.management': 'Управление мульти-кошельками',
  'setting.client': 'Клиент',
  'setting.accounts': 'Учётные записи',
  'setting.export': 'Экспортировать',
  'setting.lock': 'Заблокировать',
  'setting.view.phrase': 'Показать секретную фразу',
  'setting.language': 'Язык',
  'setting.version': 'Версия',
  'setting.connected': 'Подключён',
  'setting.notconnected': 'Нет соединения',
  'setting.add.device': 'Добавить устройство',
  'setting.wallet.index': 'Индекс',
  'setting.wallet.account': 'Аккаунт',
  'setting.wallet.index.info': 'Введите индекс Ledger адреса, который вы хотите использовать',
  'setting.wallet.account.info': 'Введите номер счета, чтобы управлять несколькими счетами в одном кошельке',
  'setting.wallet.hdpath.legacy.info': 'Устаревший путь деривации {path}',
  'setting.wallet.hdpath.ledgerlive.info': 'Путь деривации Ledger Live {path}',
  'setting.wallet.hdpath.metamask.info': 'Путь деривации Metamask {path}',
  'setting.wallet.storeAddress.info':
    'Сохраните свои доверенные адреса в локальном хранилище, они будут перечислены под цепочкой или в режиме отправки',
  'setting.thornode.node.error.unhealthy': 'API THORNode выдаёт дичь при проверке "{endpoint}"',
  'setting.thornode.node.error.url': 'Неверный URL API THORNode. Пожалуйста, перепроверьте и попробуйте еще раз',
  'setting.thornode.rpc.error.url': 'Неверный URL RPC THORNode. Пожалуйста, перепроверьте и попробуйте еще раз',
  'setting.thornode.rpc.error.unhealthy': 'RPC THORNode выдаёт дичь при проверке "{endpoint}"',
  'setting.thornode.node.valid': 'Действительный URL API THORNode',
  'setting.thornode.rpc.valid': 'Действительный URL RPC THORNode',
  'setting.mayanode.node.error.unhealthy': 'API MAYANode выдаёт дичь при проверке "{endpoint}"',
  'setting.mayanode.node.error.url': 'Неверный URL API MAYANode. Пожалуйста, перепроверьте и попробуйте еще раз',
  'setting.mayanode.rpc.error.url': 'Неверный URL RPC MAYANode. Пожалуйста, перепроверьте и попробуйте еще раз',
  'setting.mayanode.rpc.error.unhealthy': 'RPC MAYANode выдаёт дичь при проверке "{endpoint}"',
  'setting.mayanode.node.valid': 'Действительный URL API MAYANode',
  'setting.mayanode.rpc.valid': 'Действительный URL RPC MAYANode'
}

export default settings
