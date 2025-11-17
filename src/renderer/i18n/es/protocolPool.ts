import { ProtocolPoolMessages } from '../types'

const protocolPool: ProtocolPoolMessages = {
  // General protocol pool keys
  'protocolPool.detail.title': 'Posición del Pool de Protocolo',
  'protocolPool.detail.availability': 'Pool de protocolo actualmente no disponible',
  'protocolPool.detail.titleDeposit': 'Depósito en Pool de Protocolo',
  'protocolPool.detail.titleWithdraw': 'Retiro del Pool de Protocolo',
  'protocolPool.detail.current.title': 'Valor del depósito',
  'protocolPool.detail.redeem.title': 'Valor de canje',
  'protocolPool.detail.percent': 'Crecimiento',
  'protocolPool.detail.totalGrowth': 'Crecimiento en USD',
  'protocolPool.detail.priceGrowth': 'Crecimiento del precio',
  'protocolPool.detail.assetAmount': 'Cantidad del activo',
  'protocolPool.detail.daysLeft': 'Días restantes hasta que puedas retirar',
  'protocolPool.detail.blocksLeft': 'Bloques restantes hasta que puedas retirar',
  'protocolPool.detail.warning': 'Depositar en pool de protocolo reiniciará el período de retiro',
  'protocolPool.info.max.withdraw.value': 'Valor máximo para retirar',
  'protocolPool.info.max.balance': 'Saldo máximo',
  'protocolPool.add.state.sending': 'Enviando transacción de adición',
  'protocolPool.add.state.checkResults': 'Verificando resultados de la transacción',
  'protocolPool.add.state.pending': 'Añadiendo al pool',
  'protocolPool.add.state.success': 'Adición al pool exitosa',
  'protocolPool.add.state.error': 'Error al añadir al pool',
  'protocolPool.withdraw.state.sending': 'Enviando transacción de retiro',
  'protocolPool.withdraw.state.checkResults': 'Verificando resultados de la transacción',
  'protocolPool.withdraw.state.pending': 'Retirando del pool',
  'protocolPool.withdraw.state.success': 'Retiro del pool exitoso',
  'protocolPool.withdraw.state.error': 'Error al retirar del pool',
  // RUNE specific
  'protocolPool.rune.noAdded': 'No has añadido al pool de runas',
  'protocolPool.rune.title': 'Posición del Pool de Runas',
  // CACAO specific
  'protocolPool.cacao.noAdded': 'No has añadido al pool de cacao',
  'protocolPool.cacao.title': 'Posición del Pool de Cacao'
}

export default protocolPool
