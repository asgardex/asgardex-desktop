import { ProtocolPoolMessages } from '../types'

const protocolPool: ProtocolPoolMessages = {
  // General protocol pool keys
  'protocolPool.detail.title': 'प्रोटोकॉल पूल स्थिति',
  'protocolPool.detail.availability': 'प्रोटोकॉल पूल वर्तमान में उपलब्ध नहीं है',
  'protocolPool.detail.titleDeposit': 'प्रोटोकॉल पूल में जमा करें',
  'protocolPool.detail.titleWithdraw': 'प्रोटोकॉल पूल से निकासी',
  'protocolPool.detail.current.title': 'जमा मूल्य',
  'protocolPool.detail.redeem.title': 'रिडीम मूल्य',
  'protocolPool.detail.percent': 'वृद्धि',
  'protocolPool.detail.totalGrowth': 'वृद्धि USD',
  'protocolPool.detail.priceGrowth': 'मूल्य वृद्धि',
  'protocolPool.detail.assetAmount': 'संपत्ति की मात्रा',
  'protocolPool.detail.daysLeft': 'निकासी करने तक शेष दिन',
  'protocolPool.detail.blocksLeft': 'निकासी करने तक शेष ब्लॉक',
  'protocolPool.detail.warning': 'प्रोटोकॉल पूल में जमा करने से निकासी अवधि रीसेट होगी',
  'protocolPool.info.max.withdraw.value': 'निकासी के लिए अधिकतम मूल्य',
  'protocolPool.info.max.balance': 'अधिकतम शेष राशि',
  'protocolPool.add.state.sending': 'ट्रांजैक्शन भेजा जा रहा है',
  'protocolPool.add.state.checkResults': 'ट्रांजैक्शन के परिणामों की जांच',
  'protocolPool.add.state.pending': 'पूल में जोड़ा जा रहा है',
  'protocolPool.add.state.success': 'पूल में जोड़ना सफल',
  'protocolPool.add.state.error': 'पूल में जोड़ने में त्रुटि',
  'protocolPool.withdraw.state.sending': 'निकासी ट्रांजैक्शन भेजा जा रहा',
  'protocolPool.withdraw.state.checkResults': 'ट्रांजैक्शन के परिणामों की जांच',
  'protocolPool.withdraw.state.pending': 'पूल से निकाला जा रहा',
  'protocolPool.withdraw.state.success': 'पूल से निकासी सफल',
  'protocolPool.withdraw.state.error': 'पूल से निकासी में त्रुटि',
  // RUNE specific
  'protocolPool.rune.noAdded': 'आपने रून पूल में कुछ नहीं जोड़ा',
  'protocolPool.rune.title': 'रून पूल स्थिति',
  // CACAO specific
  'protocolPool.cacao.noAdded': 'आपने कैकाएो पूल में कुछ नहीं जोड़ा',
  'protocolPool.cacao.title': 'कैकाएो पूल स्थिति'
}
export default protocolPool
