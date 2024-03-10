import { LedgerMessages } from '../types'

const ledger: LedgerMessages = {
  'ledger.title': 'Ledger',
  'ledger.title.sign': 'Firmar con Ledger',
  'ledger.sign': 'Haga clic en "Siguiente" para firmar la transacción en su dispositivo.',
  'ledger.blindsign':
    '"datos del contrato inteligente" o "firma ciega" debe estar habilitada para la aplicación {chain} en tu dispositivo Ledger.',
  'ledger.needsconnected': 'Asegúrese de que su dispositivo Ledger está conectado y de que la aplicación {chain} está en funcionamiento.',
  'ledger.add.device': 'Añadir Ledger',
  'ledger.error.nodevice': 'Ningún dispositivo conectado',
  'ledger.error.inuse': 'Ledger ya se utiliza para otra aplicación',
  'ledger.error.appnotopened': 'La aplicación Ledger no se abre',
  'ledger.error.noapp': 'No se ha abierto la aplicación Ledger. Por favor, abra la aplicación adecuada en Ledger.',
  'ledger.error.getaddressfailed': 'Error al obtener la dirección de Ledger',
  'ledger.error.signfailed': 'Error en la firma de la transacción por Ledger',
  'ledger.error.sendfailed': 'Falló el envío de la transacción por Ledger',
  'ledger.error.depositfailed': 'Falló el envío de la transacción de depósito por Ledger',
  'ledger.error.invalidpubkey': 'Clave pública no válida para usar Ledger.',
  'ledger.error.invaliddata': 'Datos no válidos.',
  'ledger.error.invalidresponse': 'Respuesta no válida después de enviar una transacción utilizando Ledger.',
  'ledger.error.rejected': 'Se rechaza la acción sobre Ledger.',
  'ledger.error.timeout': 'Tiempo de espera para gestionar la acción en Ledger.',
  'ledger.error.notimplemented': 'No se ha aplicado la acción para Ledger.',
  'ledger.error.denied': 'Se ha denegado el uso de Ledger',
  'ledger.error.unknown': 'Error desconocido',
  'ledger.notsupported': 'No hay soporte Ledger para {chain}.',
  'ledger.notaddedorzerobalances': 'El ledger {chain} no se ha conectado o tiene saldos cero.',
  'ledger.deposit.oneside': 'Actualmente Ledger sólo es compatible con un lado de los activos.',
  'ledger.legacyformat.note': 'Ledger muestra todas las direcciones de salida en formato "legacy", pero no en formato "CashAddr".',
  'ledger.legacyformat.show': 'Mostrar direcciones',
  'ledger.legacyformat.hide': 'Ocultar direcciones'
}

export default ledger
