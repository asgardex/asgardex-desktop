import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain временно приостановлен.',
  'halt.trading': 'Торговля по всем пулам временно приостановлена.',
  'halt.chain': 'Торговля на цепочке {chain} на платформе {dex} временно приостановлена.',
  'halt.chains': 'Торговля для цепочек {chains} приостановлена.',
  'halt.chain.trading': 'Торговля {chains} временно приостановлена.',
  'halt.chain.synth': 'Синтетическая торговля для {chain} недоступна, пока {chain} приостановлен',
  'halt.chain.pause': 'Операции с ликвидностью(добавление/вывод) для цепочки(ек) {chains} временно отключено.',
  'halt.chain.pauseall': 'Операции с ликвидностью(добавление/вывод) для всех цепочек временно отключено.'
}

export default halt
