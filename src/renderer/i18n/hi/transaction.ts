import { TransactionMessages } from '../types'

const transaction: TransactionMessages = {
  'transaction.status.complete': 'पूर्ण',
  'transaction.status.pending': 'लंबित',
  'transaction.status.observing': 'अवलोकन',
  'transaction.status.confirming': 'पुष्टि ({time} शेष)',
  'transaction.status.confirming.simple': 'पुष्टि',
  'transaction.status.finalising': 'अंतिम रूप देना',
  'transaction.status.swapping': 'अदला-बदली',
  'transaction.status.streaming': 'स्ट्रीमिंग ({current}/{total})',
  'transaction.status.outbound': 'आउटबाउंड',
  'transaction.status.outbound.delay': 'आउटबाउंड देरी ({time} शेष)'
}

export default transaction
