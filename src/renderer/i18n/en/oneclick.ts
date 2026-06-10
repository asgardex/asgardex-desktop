import { OneClickMessages } from '../types'

const oneclick: OneClickMessages = {
  'oneclick.status.refunded': 'Refunded',
  'oneclick.status.refunded.detail': 'Deposit was refunded',
  'oneclick.status.failed': 'Failed',
  'oneclick.status.failed.detail': 'Swap failed',
  'oneclick.status.pending.detail': 'Waiting for 1Click to see the deposit...',
  'oneclick.status.knownDeposit': 'Deposit registered',
  'oneclick.status.knownDeposit.detail': '1Click has acknowledged your deposit tx',
  'oneclick.status.pendingDeposit': 'Awaiting confirmation',
  'oneclick.status.pendingDeposit.detail': 'Waiting for chain confirmations...',
  'oneclick.status.incomplete': 'Partial deposit',
  'oneclick.status.incomplete.detail': 'Less than the quoted amount was received',
  'oneclick.status.processing': 'Routing',
  'oneclick.status.processing.detail': 'Solvers are executing the swap...',
  'oneclick.status.unknown': 'Processing',
  'oneclick.refunded': 'Refunded',
  'oneclick.failed': 'Failed',
  'oneclick.completed': 'Completed',
  'oneclick.field.amount': 'Amount:',
  'oneclick.field.time': 'Time:',
  'oneclick.field.depositAddress': 'Deposit:',
  'oneclick.field.originTx': 'Origin Tx:',
  'oneclick.field.destinationTx': 'Destination Tx:',
  'oneclick.field.received': 'Received:'
}

export default oneclick
