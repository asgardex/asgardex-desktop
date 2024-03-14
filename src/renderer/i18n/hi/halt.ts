import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain अस्थायी रूप से स्थगित किया गया है।',
  'halt.trading': 'सभी पूलों में ट्रेडिंग अस्थायी रूप से स्थगित की गई है।',
  'halt.chain': '{chain} चेन {dex} पर अस्थायी रूप से रोक दी गई है।',
  'halt.chains': '{chains} चेनों पर ट्रेडिंग स्थगित की गई है।',
  'halt.chain.trading': '{chains} में ट्रेडिंग अस्थायी रूप से स्थगित की गई है।',
  'halt.chain.synth': '{chain} चेन स्थगित होने तक {chain} के लिए सिंथेटिक ट्रेडिंग उपलब्ध नहीं है।',
  'halt.chain.pause':
    '{chains} चेन(ओं) के लिए लिक्विडिटी ऑपरेशन (जोड़ना/निकालना) अस्थायी रूप से निष्क्रिय कर दिए गए हैं।',
  'halt.chain.pauseall': 'सभी चेनों के लिए लिक्विडिटी ऑपरेशन (जोड़ना/निकालना) अस्थायी रूप से निष्क्रिय कर दिए गए हैं।'
}

export default halt
