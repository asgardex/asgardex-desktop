import { BondsMessages } from '../types'

const bonds: BondsMessages = {
  'bonds.node': 'Node',
  'bonds.bond': 'Bond',
  'bonds.currentBond': 'Current Bond',
  'bonds.bondProvider': 'Bond Provider',
  'bonds.award': 'Award',
  'bonds.status': 'Status',
  'bonds.status.active': 'Active',
  'bonds.status.ready': 'Ready',
  'bonds.status.standby': 'Standby',
  'bonds.status.disabled': 'Disabled',
  'bonds.status.whitelisted': 'Whitelisted',
  'bonds.nodes.error': 'Error while loading node data',
  'bonds.node.add': 'Add node',
  'bonds.node.enterMessage': 'Enter node to monitor',
  'bonds.validations.nodeAlreadyAdded': 'Node is already added',
  'bonds.node.removeMessage': 'Are you sure you want to remove node with address {node} ?',
  'bonds.validations.bondStatusActive': 'Unbonding from an active node is not allowed'
}

export default bonds
