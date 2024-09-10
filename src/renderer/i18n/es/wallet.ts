import { WalletMessages } from '../types'

const wallet: WalletMessages = {
  'wallet.name': 'Nombre de la cartera',
  'wallet.name.maxChars': 'Máx. {max} caracteres',
  'wallet.name.error.empty': 'Introduzca un nombre para su monedero',
  'wallet.name.error.duplicated': 'El nombre ya existe, por favor utilice otro nombre.',
  'wallet.name.error.rename': 'Error al renombrar el monedero',
  'wallet.nav.deposits': 'Depósitos',
  'wallet.nav.bonds': 'Bonos',
  'wallet.nav.poolshares': 'PL Acciones',
  'wallet.nav.savers': 'Ahorradores',
  'wallet.nav.runepool': 'Piscina de Runa',
  'wallet.column.name': 'Nombre',
  'wallet.column.ticker': 'Ticker',
  'wallet.action.send': 'Enviar',
  'wallet.action.receive': 'Reciba',
  'wallet.action.receive.title': 'Reciba {asset}',
  'wallet.action.forget': 'Olvídese',
  'wallet.action.unlock': 'Desbloquear',
  'wallet.action.connect': 'Conectar',
  'wallet.action.import': 'Importar',
  'wallet.action.create': 'Cree',
  'wallet.action.deposit': 'Depósito',
  'wallet.balance.total.poolAssets': 'Saldo total de los activos de la billetera',
  'wallet.balance.total.poolAssets.info':
    'Saldo total de los activos de la billetera utilizando datos de pool de Thorchain & Mayachain. Los pools son la fuente de la verdad para determinar los precios en THORChain y MAYAchain.',
  'wallet.balance.total.tradeAssets': 'Saldo total de activos comerciales',
  'wallet.balance.total.tradeAssets.info':
    'Saldo total de activos comerciales utilizando datos de los pools de Thorchain. Los pools son la fuente de verdad para determinar precios en THORChain',
  'wallet.shares.total': 'Valor total',
  'wallet.connect.instruction': 'Conecte su monedero',
  'wallet.lock.label': 'Cartera de cerraduras',
  'wallet.unlock.label': 'Desbloquear la cartera',
  'wallet.unlock.title': 'Desbloquear "{name}"',
  'wallet.unlock.instruction': 'Por favor, desbloquee su cartera',
  'wallet.unlock.password': 'Introduzca su contraseña',
  'wallet.unlock.error':
    'No se ha podido desbloquear el monedero. Por favor, compruebe su contraseña e inténtelo de nuevo',
  'wallet.imports.keystore.select': 'Seleccione el archivo de almacén de claves',
  'wallet.imports.keystore.title': 'Por favor, elija el archivo keystore de su monedero',
  'wallet.imports.phrase.title': 'Introduzca la frase de su cartera con un solo espacio entre las palabras',
  'wallet.imports.wallet': 'Importar monedero existente',
  'wallet.imports.enterphrase': 'Introduzca la frase',
  'wallet.imports.error.instance': 'No se ha podido crear una instancia de Cliente',
  'wallet.imports.error.keystore.load': 'Almacén de claves no válido',
  'wallet.imports.error.keystore.import': 'Error al importar carteras de almacén de claves',
  'wallet.imports.error.ledger.import': 'Error al intentar importar cuentas del libro mayor',
  'wallet.imports.error.keystore.password': 'Contraseña no válida',
  'wallet.phrase.error.valueRequired': 'El valor de la frase es obligatorio',
  'wallet.phrase.error.invalid': 'Frase no válida',
  'wallet.phrase.error.import': 'Error al importar la frase',
  'wallet.imports.error.phrase.empty': 'Importar un monedero existente con fondos',
  'wallet.txs.history': 'Historial de transacciones',
  'wallet.txs.history.disabled': 'El historial de transacciones de {chain} se ha desactivado temporalmente',
  'wallet.create.copy.phrase': 'Copiar la frase',
  'wallet.create.error.phrase.empty': 'Crear un nuevo monedero, añadirle fondos',
  'wallet.add.another': 'Añadir otra cartera',
  'wallet.add.label': 'Añadir cartera',
  'wallet.change.title': 'Cambiar la cartera',
  'wallet.change.error': 'Error al cambiar un monedero',
  'wallet.selected.title': 'Cartera seleccionada',
  'wallet.create.title': 'Crear un nuevo monedero',
  'wallet.create.enter.phrase': 'Introduzca su frase en el orden correcto',
  'wallet.create.error.phrase': 'Frase incorrecta. Por favor, compruebe su frase y vuelva a introducirla.',
  'wallet.create.words.click': 'Pulse la palabra en el orden correcto',
  'wallet.create.creating': 'Crear cartera…',
  'wallet.create.error': 'Error al crear un monedero',
  'wallet.receive.address.error': 'No hay dirección disponible para recibir fondos',
  'wallet.receive.address.errorQR': 'Error al procesar el código QR: {error}',
  'wallet.remove.label': 'Olvídate de la cartera',
  'wallet.remove.label.title': '¿Estás seguro de que quieres olvidar "{name}"?',
  'wallet.remove.label.description':
    'Deberá proporcionar su frase para volver a crear su monedero. Asegúrate de tener tu frase guardada en un lugar seguro antes de continuar.',
  'wallet.send.success': 'Transacción realizada.',
  'wallet.send.fastest': 'Más rápido',
  'wallet.send.fast': 'Rápido',
  'wallet.send.affiliateTracking': 'Memo de intercambio detectado, se aplicó tarifa de afiliado de 10 puntos básicos',
  'wallet.send.notAllowed': 'No permitido',
  'wallet.send.average': 'Media',
  'wallet.send.fundsLoss': 'Se perderán fondos al enviar a esta dirección.',
  'wallet.send.max.doge':
    'El valor máximo calculado se basa en las tasas estimadas, que pueden ser incorrectas para DOGE de vez en cuando. En caso de que aparezca el mensaje de error "Saldo insuficiente para la transacción", consulte https://blockchair.com/dogecoin/transactions para obtener un promedio de las últimas comisiones e intente deducirlo de su saldo antes de enviar una transacción.',
  'wallet.errors.balancesFailed': 'Error en la carga de saldos. {errorMsg}',
  'wallet.errors.asset.notExist': 'No {asset} activo',
  'wallet.errors.address.empty': 'La dirección no puede estar vacía',
  'wallet.errors.address.invalid': 'La dirección no es válida',
  'wallet.errors.address.inbound': 'Precaución {type} Dirección detectada',
  'wallet.errors.address.couldNotFind': 'No se ha podido encontrar la dirección de la fondo {pool}',
  'wallet.errors.amount.shouldBeNumber': 'El importe debe ser un número',
  'wallet.errors.amount.shouldBeGreaterThan': 'El importe debe ser superior a {amount}',
  'wallet.errors.amount.shouldBeGreaterOrEqualThan': 'El importe debe ser igual o superior a {amount}',
  'wallet.errors.amount.shouldBeLessThanBalance': 'El importe debe ser inferior al saldo',
  'wallet.errors.amount.shouldBeLessThanBalanceAndFee': 'El importe debe ser inferior al saldo menos la comisión.',
  'wallet.errors.fee.notCovered': 'Las tasas no están cubiertas por su saldo ({balance})',
  'wallet.errors.invalidChain': 'Cadena inválida: {chain}',
  'wallet.errors.memo.max': 'La longitud de la nota no puede ser superior a {max}',
  'wallet.password.confirmation.title': 'Confirmación de la contraseña de la cartera',
  'wallet.password.confirmation.description': 'Por favor, introduzca la contraseña de su monedero.',
  'wallet.password.confirmation.pending': 'Validación de la contraseña',
  'wallet.password.empty': 'Introduzca una contraseña',
  'wallet.password.confirmation.error': 'Contraseña incorrecta',
  'wallet.password.repeat': 'Repetir contraseña',
  'wallet.password.mismatch': 'Contraseña incorrecta',
  'wallet.send.error': 'Enviar error',
  'wallet.validations.lessThen': 'Debería ser menos entonces {value}',
  'wallet.validations.graterThen': 'Debería ser más rallado entonces {value}',
  'wallet.validations.shouldNotBeEmpty': 'No debe estar vacío',
  'wallet.ledger.verifyAddress.modal.title': 'Verificar la dirección del Ledger',
  'wallet.ledger.verifyAddress.modal.description': 'Verifique la dirección {address} en su dispositivo',
  'wallet.ledger.removeAddress': 'Eliminar la dirección del ledger para la cadena {chain}',
  'wallet.ledger.viewAddress': 'Ver dirección en el explorador'
}

export default wallet
