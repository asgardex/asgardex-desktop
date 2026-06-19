import { SwapMessages } from '../types'

const swap: SwapMessages = {
  'swap.state.sending': 'Enviando transacción',
  'swap.state.pending': 'Intercambio',
  'swap.state.success': 'Canje satisfactorio',
  'swap.state.error': 'Error de intercambio',
  'swap.input': 'Entrada',
  'swap.output': 'Salida',
  'swap.info.max.balance': 'Saldo activo total({balance})',
  'swap.info.max.balanceMinusFee':
    'Saldo total del activo ({balance}) restado por las comisiones estimadas del swap ( {fee})',
  'swap.slip.title': 'Bajada',
  'swap.aggregator.fasterReturn': 'Retorno más rápido ...',
  'swap.aggregator.betterReturn': 'Mejor retorno ...',
  'swap.slip.tolerance': 'Bajada tolerancia',
  'swap.slip.tolerance.info':
    'Cuanto mayor sea el porcentaje, más deslizamiento aceptará. Más deslizamiento incluye también un rango más amplio para cubrir las comisiones estimadas para evitar swaps abortados.',
  'swap.streaming.interval': 'Intervalo',
  'swap.streaming.title': 'Estado del streaming',
  'swap.streaming.interval.info': 'Intervalo entre intercambios, 10 bloques es un intervalo de 1 minuto',
  'swap.streaming.quantity': 'Cantidad',
  'swap.streaming.quantity.info': 'La cantidad de mini swaps totales realizados por intervalo',
  'swap.errors.amount.balanceShouldCoverChainFee':
    'La comisión por transacción {fee} debe estar cubierta por su saldo (actualmente {balance}).',
  'swap.errors.amount.outputShouldCoverChainFee':
    'La comisión de salida de {fee} debe cubrirse con el importe recibido (actualmente {amount}).',
  'swap.errors.amount.thornodeQuoteError': '{error} : Ajustar el deslizamiento o la cantidad de entrada',
  'swap.previewOnly': 'Solo vista previa',
  'swap.previewAndSwap': 'Vista previa e intercambio',
  'swap.note.lockedWallet': 'Necesitas desbloquear tu monedero para intercambiar',
  'swap.note.nowallet': 'Crear o importar un monedero para intercambiar',
  'swap.errors.asset.missingSourceAsset': 'Falta el activo de origen',
  'swap.errors.asset.missingTargetAsset': 'Falta el activo de destino',
  'swap.errors.pool.notAvailable': 'La fondo no está disponible {pool}',
  'swap.min.amount.info':
    'Valor mínimo a intercambiar para cubrir todas las comisiones de las transacciones entrantes y salientes.',
  'swap.min.result.info':
    'Su swap está protegido por este valor mínimo basado en el {tolerance}% de tolerancia de deslizamiento seleccionado. En caso de que el precio cambie desfavorablemente más del {tolerance}%, su operación de swap se revertirá antes de la confirmación.',
  'swap.min.result.protected': 'Resultado del swap protegido',
  'swap.address.evm.warning': 'NO intercambiar a direcciones de Smart Contract',
  'swap.synth.warning':
    'La acuñación de Synths se ha descontinuado. La redención de Synths estará disponible durante los próximos 3 meses — por favor, canjéalos mientras puedas.',
  'swap.mode.rapid': 'Rapid',
  'swap.mode.streaming': 'Streaming',
  'swap.mode.instant': 'Instantáneo',
  'swap.settings.subSwaps.auto': 'Cantidad auto de swaps',
  'swap.destination.title': 'Destino de salida',
  'swap.destination.info': 'La salida del swap se enviará a esta dirección. Verifica antes de firmar.',
  'swap.destination.mismatch': 'Esto difiere del destinatario que ingresaste ({recipient}). Solo continúa si reconoces este destino.'
}

export default swap
