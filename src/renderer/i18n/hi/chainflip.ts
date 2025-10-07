import { ChainflipMessages } from '../types'

const chainflip: ChainflipMessages = {
  'chainflip.status.waiting': 'जमा का इंतजार',
  'chainflip.status.receiving': 'जमा प्राप्त कर रहे हैं',
  'chainflip.status.receiving.detail': 'आपकी जमा की प्रक्रिया हो रही है...',
  'chainflip.status.swapping': 'अदला-बदली',
  'chainflip.status.swapping.detail': 'Chainflip पर अदला-बदली का निष्पादन...',
  'chainflip.status.sending': 'भेज रहे हैं',
  'chainflip.status.sending.detail': 'निकासी लेनदेन तैयार कर रहे हैं...',
  'chainflip.status.sent': 'भेजा गया',
  'chainflip.status.sent.detail': 'लेनदेन गंतव्य पर भेजा गया',
  'chainflip.status.complete': 'पूर्ण',
  'chainflip.status.complete.detail': 'अदला-बदली सफलतापूर्वक पूर्ण',
  'chainflip.status.failed': 'असफल',
  'chainflip.status.failed.detail': 'अदला-बदली असफल',
  'chainflip.status.processing': 'प्रक्रिया',
  'chainflip.status.processing.detail': 'लेनदेन चल रहा है...',
  'chainflip.status.pending.detail': 'ब्लॉकचेन डेटा का इंतजार...',
  'chainflip.completed': 'पूर्ण',
  'chainflip.field.amount': 'राशि:',
  'chainflip.field.time': 'समय:',
  'chainflip.field.channelId': 'चैनल ID:',
  'chainflip.field.swapId': 'अदला-बदली ID:',
  'chainflip.field.depositTx': 'जमा Tx:',
  'chainflip.field.egressTx': 'निकासी Tx:'
}

export default chainflip