import { ChainflipMessages } from '../types'

const chainflip: ChainflipMessages = {
  'chainflip.status.waiting': 'Waiting for deposit',
  'chainflip.status.receiving': 'Receiving deposit',
  'chainflip.status.receiving.detail': 'Processing your deposit...',
  'chainflip.status.swapping': 'Swapping',
  'chainflip.status.swapping.detail': 'Executing swap on Chainflip...',
  'chainflip.status.sending': 'Sending',
  'chainflip.status.sending.detail': 'Preparing egress transaction...',
  'chainflip.status.sent': 'Sent',
  'chainflip.status.sent.detail': 'Transaction sent to destination',
  'chainflip.status.complete': 'Complete',
  'chainflip.status.complete.detail': 'Swap completed successfully',
  'chainflip.status.failed': 'Failed',
  'chainflip.status.failed.detail': 'Swap failed',
  'chainflip.status.processing': 'Processing',
  'chainflip.status.processing.detail': 'Transaction in progress...',
  'chainflip.status.pending.detail': 'Waiting for blockchain data...',
  'chainflip.completed': 'Completed',
  'chainflip.field.amount': 'Amount:',
  'chainflip.field.time': 'Time:',
  'chainflip.field.channelId': 'Channel ID:',
  'chainflip.field.swapId': 'Swap ID:',
  'chainflip.field.depositTx': 'Deposit Tx:',
  'chainflip.field.egressTx': 'Egress Tx:'
}

export default chainflip