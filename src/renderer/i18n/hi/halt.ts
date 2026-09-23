import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain अस्थायी रूप से स्थगित है। स्वैप के लिए {alternatives} का उपयोग करें।',
  'halt.trading':
    '{protocols} पर ट्रेडिंग अस्थायी रूप से स्थगित है। {alternatives} के माध्यम से स्वैप अभी भी उपलब्ध है।',
  'halt.chain': '{chain} चेन {dex} पर अस्थायी रूप से रोक दी गई है।',
  'halt.chains': '{chains} चेनों को {protocol} पर अस्थायी रूप से रोका गया है।',
  'halt.chain.trading': '{protocol}: {chains} के लिए ट्रेडिंग अस्थायी रूप से स्थगित है।',
  'halt.chain.synth': '{chain} चेन स्थगित होने तक {chain} के लिए सिंथेटिक ट्रेडिंग उपलब्ध नहीं है।',
  'halt.chain.pause':
    '{chains} चेन(ओं) के लिए लिक्विडिटी ऑपरेशन (जोड़ना/निकालना) अस्थायी रूप से निष्क्रिय कर दिए गए हैं।',
  'halt.chain.pauseall': 'सभी चेनों के लिए लिक्विडिटी ऑपरेशन (जोड़ना/निकालना) अस्थायी रूप से निष्क्रिय कर दिए गए हैं।',
  'halt.chain.pauseDeposits': '{chains} चेन(s) के लिए लिक्विडिटी डिपॉजिट (जोड़ना) अस्थायी रूप से अक्षम कर दिए गए हैं।',
  'halt.swap.routeImpaired': 'स्वैप रूट बाधित हो सकता है'
}

export default halt
