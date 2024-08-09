import { CommonMessages } from '../types'

const common: CommonMessages = {
  'common.stats': 'Estadísticas',
  'common.network': 'Red',
  'common.dex': 'IDE',
  'common.faqs': 'PF',
  'common.greeting': 'Hola {name}',
  'common.copyright': '©',
  'common.type': 'Tipo',
  'common.address': 'Dirección',
  'common.addresses': 'Direcciones',
  'common.thorname': 'THORNombre',
  'common.thornameRegistrationSpecifics':
    'Los THORNombres permiten a cualquiera registrar direcciones de monedero de cadena cruzada a una cadena larga de 1-30 caracteres hexadecimales que incluyen caracteres especiales -_+. Los THORNames están limitados a 30 caracteres, incluyendo ^[a-zA-Z0-9+_-]+$.',
  'common.thornameError': 'THORnombre no disponible',
  'common.mayaname': 'MAYANombre',
  'common.owner': 'Propietario',
  'common.preferredAsset': 'Activo preferente',
  'common.expirationBlock': 'Bloque de expiración',
  'common.aliasChain': 'Alias Cadena',
  'common.aliasAddress': 'Alias Dirección',
  'common.expiry': 'Caducidad',
  'common.isUpdate': 'Actualización THORNombre',
  'common.address.self': 'Auto',
  'common.to': 'A',
  'common.from': 'En',
  'common.filterValue': 'Filtrar saldos vacíos',
  'common.amount': 'Importe',
  'common.coin': 'Moneda',
  'common.collapseAll': 'Contraer todo',
  'common.password': 'Contraseña',
  'common.memo': 'Memo',
  'common.memos': 'Memos',
  'common.date': 'Fecha',
  'common.refresh': 'Actualizar',
  'common.back': 'Volver',
  'common.general': 'General',
  'common.advanced': 'Avanzado',
  'common.privateData': 'Datos privados',
  'common.enable': 'Activar',
  'common.disable': 'Desactivar',
  'common.disabledChains': 'Cadenas desactivadas',
  'common.chainDisabled': 'Ha desactivado esta cadena, por favor actívela para continuar con el intercambio',
  'common.remove': 'Eliminar',
  'common.keystore': 'Keystore',
  'common.keystorePassword': 'Keystore contraseña',
  'common.ledger': 'Ledger',
  'common.phrase': 'Frase',
  'common.submit': 'Enviar',
  'common.confirm': 'Confirme',
  'common.cancel': 'Cancelar',
  'common.reject': 'Rechazar',
  'common.next': 'Siguiente',
  'common.finish': 'Acabado',
  'common.copy': 'Copia',
  'common.loading': 'Cargando…',
  'common.error': 'Error',
  'common.error.api.limit': 'Límite de velocidad API superado',
  'common.test': 'Prueba',
  'common.change': 'Cambia',
  'common.wallet': 'Cartera',
  'common.history': 'Historia',
  'common.settings': 'Ajustes',
  'common.asset': 'Activo',
  'common.assets': 'Activos',
  'common.rune': 'RUNE',
  'common.pool': 'Fondo',
  'common.pool.inbound': 'Fondo entrada',
  'common.pools': 'Fondos',
  'common.price': 'Precio',
  'common.price.rune': 'RUNE precio',
  'common.price.cacao': 'Cacao precio',
  'common.transaction': 'Transacción',
  'common.transaction.short.rune': 'RUNE ts',
  'common.transaction.short.asset': 'Asset ts',
  'common.viewTransaction': 'Ver transacción',
  'common.copyTxUrl': 'Copiar url de transacción',
  'common.trackTransaction': 'Seguimiento de la transacción',
  'common.copyTxHash': 'Copiar hash de transacción',
  'common.fee': 'Tasa',
  'common.feeRate': 'Tasa tarifa',
  'common.fee.nodeOperator': 'Tasa de operador de nodo',
  'common.fees': 'Tasas',
  'common.fee.estimated': 'Tasa estimada',
  'common.fees.estimated': 'Tasas estimadas',
  'common.fee.inbound': 'Entrada',
  'common.fee.inbound.rune': 'Entrada de RUNE',
  'common.fee.inbound.asset': 'Entrada de activos',
  'common.fee.outbound': 'Salida',
  'common.fee.outbound.rune': 'Salida de RUNE',
  'common.fee.outbound.asset': 'Salida de activos',
  'common.fee.affiliate': 'Afiliado',
  'common.max': 'Máx',
  'common.min': 'Mín',
  'common.search': 'Buscar en',
  'common.searchAsset': 'Buscar Activo',
  'common.addAssetManually': '¿No se muestra ERC20? Agrega el activo manualmente',
  'common.searchExample':
    'Ejemplo de búsqueda para cadena no sintética.ticker, es decir, btc.btc o para sintético btc/btc',
  'common.retry': 'Reintentar',
  'common.reload': 'Recarga',
  'common.action': 'Acción',
  'common.add': 'Añadir',
  'common.swap': 'Intercambiar',
  'common.savers': 'Ahorradores',
  'common.earn': 'Gane',
  'common.withdraw': 'Retirar',
  'common.liquidity': 'Liquidez',
  'common.approve': 'Aprobar',
  'common.accept': 'Acepte',
  'common.approve.checking': 'Comprobación de la asignación para {asset}',
  'common.approve.error': 'Error al comprobar la asignación de {asset}: {error}',
  'common.step': 'Paso {current}/{total}',
  'common.done': 'Hecho',
  'common.nodeAddress': 'Dirección del nodo',
  'common.providerAddress': 'Dirección del proveedor',
  'common.tx.healthCheck': 'Chequeo de salud',
  'common.tx.sending': 'Enviar transacción',
  'common.tx.sendingAsset': 'Enviar transacción {assetTicker}',
  'common.tx.success': 'La transacción se ha enviado correctamente',
  'common.tx.success-info':
    'La transacción puede tardar algún tiempo en confirmarse (hasta varios minutos dependiendo de la cadena)',
  'common.tx.checkResult': 'Comprobar resultado',
  'common.tx.view': 'Ver transacción {assetTicker}',
  'common.modal.confirmTitle': 'Confirmar acción',
  'common.value': 'Valor',
  'common.manage': 'Gestionar el PL',
  'common.managePosition': 'Gestionar posición',
  'common.analytics': 'Analítica',
  'common.asset.base': 'Base',
  'common.asset.change': 'Cambiar activo',
  'common.noResult': 'Ningún resultado',
  'common.rate': 'Tarifa',
  'common.tx.type.swap': 'Intercambiar',
  'common.tx.type.donate': 'Donar',
  'common.tx.type.refund': 'Reembolso',
  'common.tx.type.deposit': 'Depósito',
  'common.tx.type.withdraw': 'Retirar',
  'common.detail': 'Detalle',
  'common.details': 'Detalles',
  'common.filter': 'Filtro',
  'common.all': 'Todos',
  'common.time.days': '{days} días',
  'common.time.days.short': '{days}d',
  'common.time.month1': '1 mes',
  'common.time.month1.short': '1m',
  'common.time.months3': '3 meses',
  'common.time.months3.short': '3m',
  'common.time.year1': '1 año',
  'common.time.year1.short': '1y',
  'common.time.all': 'Todos',
  'common.time.all.short': 'Todos',
  'common.time.title': 'Tiempo',
  'common.inbound.time': 'Entrada',
  'common.outbound.time': 'Salida',
  'common.streaming.time': 'Streaming',
  'common.streaming.time.info': 'Tiempo estimado para completar este intercambio de flujos',
  'common.totaltransaction.time': 'Tiempo total de transacción',
  'common.confirmation.time': 'Confirmación de cadena {chain}',
  'common.theme.light': 'Modo diurno',
  'common.theme.dark': 'Modo nocturno',
  'common.volume24': 'Volumen (24h)',
  'common.volume24.description': 'Volumen 24h de swaps, liquidez añadida y retiradas',
  'common.informationMore': 'Más información',
  'common.balance': 'Saldo',
  'common.balance.loading': 'Balance de carga',
  'common.balances': 'Saldos',
  'common.custom': 'A medida',
  'common.notsupported.fornetwork': 'No compatible con {network}',
  'common.recipient': 'Destinatario',
  'common.sender': 'Remitente',
  'common.legacy': 'Legado',
  'common.ledgerlive': 'Ledger Live',
  'common.metamask': 'MetaMask',
  'common.unknown': 'Desconocido',
  'common.expandAll': 'Expandir todo',
  'common.excludeSynth': 'Excluir Sintéticos',
  'common.completeLp': 'Completar Lp',
  'common.asset.quickSelect': 'Selección Rápida L1'
}

export default common
