import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain se detiene temporalmente.',
  'halt.trading': 'Se ha interrumpido temporalmente el comercio en todos los pools.',
  'halt.chain': '{chain} cadena se ha detenido temporalmente.',
  'halt.chain.synth': 'La negociación sintética para {chain} no está disponible mientras {chain} está parada',
  'halt.chains': '{chains} cadenas se han detenido temporalmente.',
  'halt.chain.trading': 'Se ha interrumpido temporalmente el comercio de {chains} cadena(s).',
  'halt.chain.pause': 'Las actividades de liquidez (añadir/eliminar) para cadena(s) {chains} han sido desactivadas temporalmente.',
  'halt.chain.pauseall': 'Se han desactivado temporalmente las actividades de liquidez (añadir/eliminar) para todas las cadenas.'
}

export default halt
