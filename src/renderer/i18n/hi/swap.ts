import { SwapMessages } from '../types'

const swap: SwapMessages = {
  'swap.state.pending': 'स्वैपिंग जारी है',
  'swap.state.success': 'सफल स्वैप',
  'swap.state.error': 'स्वैप में त्रुटि',
  'swap.input': 'इनपुट',
  'swap.output': 'आउटपुट',
  'swap.info.max.balance': 'कुल संपत्ति संतुलन ({balance})',
  'swap.info.max.balanceMinusFee': 'कुल संपत्ति संतुलन ({balance}) अनुमानित स्वैप शुल्कों ({fee}) द्वारा घटाया गया',
  'swap.slip.title': 'स्लिप',
  'swap.slip.tolerance': 'स्लिपेज सहिष्णुता',
  'swap.slip.tolerance.info':
    'प्रतिशत जितना अधिक होगा, उतनी अधिक स्लिपेज स्वीकार करेंगे। अधिक स्लिपेज में रद्द स्वैप्स से बचने के लिए अनुमानित शुल्कों को कवर करने के लिए भी व्यापक रेंज शामिल है।',
  'swap.slip.tolerance.ledger-disabled.info': 'तकनीकी समस्याओं के कारण Ledger के साथ स्लिपेज सहिष्णुता अक्षम की गई है।',
  'swap.streaming.interval': 'अंतराल',
  'swap.streaming.interval.info': 'स्वैप्स के बीच का अंतराल, 10 ब्लॉक 1 मिनट का अंतराल है',
  'swap.streaming.quantity': 'मात्रा',
  'swap.streaming.quantity.info': 'प्रति अंतराल कुल मिनी स्वैप्स की मात्रा',
  'swap.errors.amount.balanceShouldCoverChainFee':
    'लेन-देन शुल्क {fee} को आपके संतुलन द्वारा कवर किया जाना चाहिए (वर्तमान में {balance})।',
  'swap.errors.amount.outputShouldCoverChainFee':
    'प्राप्त राशि द्वारा कवर किया जाने वाला आउटबाउंडिंग शुल्क {fee} (वर्तमान में {amount})।',
  'swap.errors.amount.thornodeQuoteError': '{error} : स्लिप या इनपुट राशि समायोजित करें',
  'swap.errors.pool.notAvailable': 'पूल उपलब्ध नहीं है',
  'swap.note.lockedWallet': 'स्वैप करने के लिए आपको अपने वॉलेट को अनलॉक करने की आवश्यकता है',
  'swap.note.nowallet': 'स्वैप करने के लिए वॉलेट बनाएं या आयात करें',
  'swap.errors.asset.missingSourceAsset': 'स्रोत संपत्ति गायब है',
  'swap.errors.asset.missingTargetAsset': 'लक्षित संपत्ति गायब है',
  'swap.min.amount.info': 'इनबाउंड और आउटबाउंड लेन-देन के सभी शुल्कों को कवर करने के लिए न्यूनतम स्वैप मूल्य।',
  'swap.min.result.info':
    'चुने गए {tolerance}% स्लिपेज सहिष्णुता के आधार पर आपके स्वैप को इस न्यूनतम मूल्य द्वारा सुरक्षित किया जाता है। यदि मूल्य {tolerance}% से अधिक अनुकूल नहीं बदलता है तो आपका स्वैप लेन-देन पुष्टि से पहले वापस कर दिया जाएगा।',
  'swap.min.result.protected': 'सुरक्षित स्वैप परिणाम'
}
export default swap
