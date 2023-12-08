import { LedgerMessages } from '../types'

const ledger: LedgerMessages = {
  'ledger.title': 'Ledger',
  'ledger.title.sign': 'Ledger के साथ हस्ताक्षर करें',
  'ledger.sign': 'अपने डिवाइस पर लेन-देन को हस्ताक्षरित करने के लिए "आगे बढ़ें" पर क्लिक करें।',
  'ledger.blindsign':
    'आपके Ledger डिवाइस पर {chain} एप्लिकेशन के लिए "स्मार्ट-कॉन्ट्रैक्ट डेटा" या "ब्लाइंड साइनिंग" सक्षम होना चाहिए।',
  'ledger.needsconnected': 'सुनिश्चित करें कि आपका Ledger जुड़ा हुआ है और {chain} एप्लिकेशन चालू है।',
  'ledger.add.device': 'Ledger जोड़ें',
  'ledger.error.nodevice': 'कोई जुड़ी हुई डिवाइस नहीं',
  'ledger.error.inuse': 'यह डिवाइस किसी अन्य एप्लिकेशन में उपयोग में है',
  'ledger.error.appnotopened': 'Ledger एप्लिकेशन खुली नहीं है',
  'ledger.error.noapp': 'कोई Ledger एप्लिकेशन नहीं खुली है। कृपया अपने डिवाइस पर संबंधित एप्लिकेशन खोलें।',
  'ledger.error.getaddressfailed': 'Ledger से पता जोड़ने में विफल',
  'ledger.error.signfailed': 'Ledger का उपयोग करके लेन-देन हस्ताक्षरित करने में विफल',
  'ledger.error.sendfailed': 'Ledger का उपयोग करके लेन-देन भेजने में विफल',
  'ledger.error.depositfailed': 'Ledger का उपयोग करके फंड जमा करने के लेन-देन में विफल',
  'ledger.error.invalidpubkey': 'Ledger का उपयोग करने के लिए अवैध पब्लिक की।',
  'ledger.error.invaliddata': 'अवैध डेटा।',
  'ledger.error.invalidresponse': 'Ledger का उपयोग करके लेन-देन भेजने के बाद अवैध प्रतिक्रिया।',
  'ledger.error.rejected': 'Ledger पर क्रिया अस्वीकृत की गई।',
  'ledger.error.timeout': 'Ledger पर क्रिया के प्रोसेसिंग के लिए टाइम-आउट।',
  'ledger.error.notimplemented': 'Ledger के साथ क्रिया नहीं की गई।',
  'ledger.error.denied': 'आपने Ledger अनुरोध अस्वीकृत किया है',
  'ledger.error.unknown': 'अज्ञात त्रुटि',
  'ledger.notsupported': 'Ledger {chain} का समर्थन नहीं करता।',
  'ledger.notaddedorzerobalances': 'Ledger {chain} नहीं जुड़ा या शून्य बैलेंस है।',
  'ledger.deposit.oneside': 'Ledger फिलहाल केवल एकतरफा एसेट जोड़ने का समर्थन करता है।',
  'ledger.legacyformat.note': 'Ledger "लेगेसी" फॉर्मेट में सभी आउटपुट पते दिखाता है, "CashAddr" फॉर्मेट में नहीं।',
  'ledger.legacyformat.show': 'पते दिखाएं',
  'ledger.legacyformat.hide': 'पते छुपाएं'
}

export default ledger
