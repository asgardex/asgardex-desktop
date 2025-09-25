import { BondsMessages } from '../types'

const bonds: BondsMessages = {
  'bonds.node': 'Nodo',
  'bonds.bond': 'Bono',
  'bonds.currentBond': 'Bono Actual',
  'bonds.bondProvider': 'Proveedor de bonos',
  'bonds.award': 'Premio',
  'bonds.status': 'Estado',
  'bonds.status.active': 'Activo',
  'bonds.status.ready': 'Listo',
  'bonds.status.standby': 'En espera',
  'bonds.status.disabled': 'Discapacitados',
  'bonds.status.whitelisted': 'Lista blanca',
  'bonds.nodes.error': 'Error al cargar datos de nodos',
  'bonds.node.add': 'Añadir nodo',
  'bonds.node.enterMessage': 'Introduzca el nodo a supervisar',
  'bonds.validations.nodeAlreadyAdded': 'Nodo ya añadido',
  'bonds.node.removeMessage': '¿Estás seguro de que quieres eliminar el nodo con dirección {node} ?',
  'bonds.validations.bondStatusActive': 'Desvincularse de un nodo activo no está permitido',
  'bonds.tooltip.removeFromWatchlist': 'Eliminar este proveedor de bonos de la lista de seguimiento',
  'bonds.tooltip.addToWatchlist': 'Agregar este proveedor de bonos a la lista de seguimiento'
}

export default bonds
