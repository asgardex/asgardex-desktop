import { ProtocolPoolMessages } from '../types'

const protocolPool: ProtocolPoolMessages = {
  // General protocol pool keys
  'protocolPool.detail.title': 'Protocol Pool Position',
  'protocolPool.detail.availability': 'Protocol Pool currently not available',
  'protocolPool.detail.titleDeposit': 'Deposit to Protocol Pool',
  'protocolPool.detail.titleWithdraw': 'Withdraw from Protocol Pool',
  'protocolPool.detail.current.title': 'Deposit value',
  'protocolPool.detail.redeem.title': 'Redeem value',
  'protocolPool.detail.percent': 'Growth',
  'protocolPool.detail.totalGrowth': 'Growth Usd',
  'protocolPool.detail.priceGrowth': 'Price growth',
  'protocolPool.detail.assetAmount': 'Asset Amount',
  'protocolPool.detail.daysLeft': 'Days remaining until you can withdraw',
  'protocolPool.detail.blocksLeft': 'Blocks remaining until you can withdraw',
  'protocolPool.detail.warning': 'Depositing to protocol pool will reset the withdraw period',
  'protocolPool.info.max.withdraw.value': 'Max value to withdraw',
  'protocolPool.info.max.balance': 'Max balance',
  'protocolPool.add.state.sending': 'Sending add transaction',
  'protocolPool.add.state.checkResults': 'Checking transaction results',
  'protocolPool.add.state.pending': 'Adding to pool',
  'protocolPool.add.state.success': 'Successful pool add',
  'protocolPool.add.state.error': 'Error adding to pool',
  'protocolPool.withdraw.state.sending': 'Sending withdraw transaction',
  'protocolPool.withdraw.state.checkResults': 'Checking transaction results',
  'protocolPool.withdraw.state.pending': 'Withdrawing from pool',
  'protocolPool.withdraw.state.success': 'Successful pool withdraw',
  'protocolPool.withdraw.state.error': 'Error withdrawing from pool',
  // RUNE specific
  'protocolPool.rune.noAdded': 'You have not added to the rune pool',
  'protocolPool.rune.title': 'Rune Pool Position',
  // CACAO specific
  'protocolPool.cacao.noAdded': 'You have not added to the cacao pool',
  'protocolPool.cacao.title': 'Cacao Pool Position'
}

export default protocolPool
