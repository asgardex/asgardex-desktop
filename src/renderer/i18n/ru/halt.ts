import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain временно приостановлен. Используйте {alternatives} для обменов.',
  'halt.trading': 'Торговля на {protocols} временно приостановлена. Обмен через {alternatives} по-прежнему доступен.',
  'halt.chain': 'Торговля на цепочке {chain} на платформе {dex} временно приостановлена.',
  'halt.chains': 'Цепочки {chains} на {protocol} временно приостановлены.',
  'halt.chain.trading': 'Торговля {chains} временно приостановлена.',
  'halt.chain.synth': 'Синтетическая торговля для {chain} недоступна, пока {chain} приостановлен',
  'halt.chain.pause': 'Операции с ликвидностью(добавление/вывод) для цепочки(ек) {chains} временно отключено.',
  'halt.chain.pauseall': 'Операции с ликвидностью(добавление/вывод) для всех цепочек временно отключено.',
  'halt.chain.pauseDeposits': 'Депозиты ликвидности (добавление) для цепочки(ей) {chains} временно отключены.',
  'halt.swap.routeImpaired': 'Маршрут обмена может быть нарушен'
}

export default halt
