import { OneClickMessages } from '../types'

const oneclick: OneClickMessages = {
  'oneclick.status.refunded': 'Reembolsado',
  'oneclick.status.refunded.detail': 'El depósito fue reembolsado',
  'oneclick.status.failed': 'Fallido',
  'oneclick.status.failed.detail': 'El intercambio falló',
  'oneclick.status.pending.detail': 'Esperando a que 1Click detecte el depósito...',
  'oneclick.status.knownDeposit': 'Depósito registrado',
  'oneclick.status.knownDeposit.detail': '1Click ha reconocido tu transacción de depósito',
  'oneclick.status.pendingDeposit': 'Esperando confirmación',
  'oneclick.status.pendingDeposit.detail': 'Esperando confirmaciones de la cadena...',
  'oneclick.status.incomplete': 'Depósito parcial',
  'oneclick.status.incomplete.detail': 'Se recibió menos del monto cotizado',
  'oneclick.status.processing': 'Enrutando',
  'oneclick.status.processing.detail': 'Los solvers están ejecutando el intercambio...',
  'oneclick.status.unknown': 'Procesando',
  'oneclick.refunded': 'Reembolsado',
  'oneclick.failed': 'Fallido',
  'oneclick.completed': 'Completado',
  'oneclick.field.amount': 'Monto:',
  'oneclick.field.time': 'Tiempo:',
  'oneclick.field.depositAddress': 'Depósito:',
  'oneclick.field.originTx': 'Tx de origen:',
  'oneclick.field.destinationTx': 'Tx de destino:',
  'oneclick.field.received': 'Recibido:'
}

export default oneclick
