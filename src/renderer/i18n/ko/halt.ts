import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain이 일시적으로 중단되었습니다.',
  'halt.trading': '모든 풀에서 거래가 일시적으로 중단되었습니다.',
  'halt.chain': '{dex}의 {chain} 체인이 일시적으로 중단되었습니다.',
  'halt.chain.synth': '{chain} 체인이 중단된 동안 {chain}의 합성 거래는 사용할 수 없습니다.',
  'halt.chains': '{protocol}의 {chains} 체인들이 일시적으로 중단되었습니다.',
  'halt.chain.trading': '{chains} 체인(들)에서 거래가 일시적으로 중단되었습니다.',
  'halt.chain.pause': '{chains} 체인(들)의 유동성 활동(추가/제거)이 일시적으로 비활성화되었습니다.',
  'halt.chain.pauseall': '모든 체인의 유동성 활동(추가/제거)이 일시적으로 비활성화되었습니다.',
  'halt.chain.pauseDeposits': '{chains} 체인(들)에 대한 유동성 예치(추가)가 일시적으로 비활성화되었습니다.'
}

export default halt
