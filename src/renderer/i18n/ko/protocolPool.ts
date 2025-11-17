import { ProtocolPoolMessages } from '../types'

const protocolPool: ProtocolPoolMessages = {
  // General protocol pool keys
  'protocolPool.detail.title': '프로토콜 풀 포지션',
  'protocolPool.detail.availability': '프로토콜 풀이 현재 사용 불가능합니다',
  'protocolPool.detail.titleDeposit': '프로토콜 풀에 예치',
  'protocolPool.detail.titleWithdraw': '프로토콜 풀에서 인출',
  'protocolPool.detail.current.title': '예치 금액',
  'protocolPool.detail.redeem.title': '상환 금액',
  'protocolPool.detail.percent': '성장률',
  'protocolPool.detail.totalGrowth': 'USD 성장률',
  'protocolPool.detail.priceGrowth': '가격 상승률',
  'protocolPool.detail.assetAmount': '자산 금액',
  'protocolPool.detail.daysLeft': '인출 가능까지 남은 일수',
  'protocolPool.detail.blocksLeft': '인출 가능까지 남은 블록 수',
  'protocolPool.detail.warning': '프로토콜 풀에 예치하면 인출 기간이 초기화됩니다',
  'protocolPool.info.max.withdraw.value': '최대 인출 금액',
  'protocolPool.info.max.balance': '최대 잔액',
  'protocolPool.add.state.sending': '트랜잭션 전송 중',
  'protocolPool.add.state.checkResults': '트랜잭션 결과 확인 중',
  'protocolPool.add.state.pending': '풀에 추가 중',
  'protocolPool.add.state.success': '풀 추가 성공',
  'protocolPool.add.state.error': '풀 추가 중 오류 발생',
  'protocolPool.withdraw.state.sending': '인출 트랜잭션 전송 중',
  'protocolPool.withdraw.state.checkResults': '트랜잭션 결과 확인 중',
  'protocolPool.withdraw.state.pending': '풀에서 인출 중',
  'protocolPool.withdraw.state.success': '풀 인출 성공',
  'protocolPool.withdraw.state.error': '풀 인출 중 오류 발생',
  // RUNE specific
  'protocolPool.rune.noAdded': 'Rune 풀에 추가하지 않았습니다',
  'protocolPool.rune.title': 'Rune 풀 포지션',
  // CACAO specific
  'protocolPool.cacao.noAdded': 'Cacao 풀에 추가하지 않았습니다',
  'protocolPool.cacao.title': 'Cacao 풀 포지션'
}

export default protocolPool
