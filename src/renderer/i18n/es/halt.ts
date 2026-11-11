import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain se detiene temporalmente. Usa {alternatives} para intercambios.',
  'halt.trading':
    'El comercio en {protocols} se ha interrumpido temporalmente. El intercambio vía {alternatives} sigue disponible.',
  'halt.chain': 'La cadena {chain} en {dex} se ha detenido temporalmente.',
  'halt.chain.synth': 'La negociación sintética para {chain} no está disponible mientras {chain} está parada',
  'halt.chains': '{chains} cadenas en {protocol} se han detenido temporalmente.',
  'halt.chain.trading': '{protocol}: comercio interrumpido temporalmente para {chains}.',
  'halt.chain.pause':
    'Las actividades de liquidez (añadir/eliminar) para cadena(s) {chains} han sido desactivadas temporalmente.',
  'halt.chain.pauseall':
    'Se han desactivado temporalmente las actividades de liquidez (añadir/eliminar) para todas las cadenas.',
  'halt.chain.pauseDeposits':
    'Los depósitos de liquidez (agregar) para la(s) cadena(s) {chains} han sido desactivados temporalmente.',
  'halt.unknown':
    'No se pudo cargar el estado de detención de {protocols}. Los depósitos de liquidez y los envíos de RUNE están bloqueados hasta que se cargue. Los intercambios siguen disponibles si se devuelve una cotización.',
  'halt.unknown.noRuneSends':
    'No se pudo cargar el estado de detención de {protocols}. Los depósitos de liquidez están bloqueados hasta que se cargue. Los intercambios siguen disponibles si se devuelve una cotización.',
  'halt.swap.routeImpaired': 'La ruta de intercambio puede estar afectada'
}

export default halt
