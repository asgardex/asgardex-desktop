import { OneClickMessages } from '../types'

const oneclick: OneClickMessages = {
  'oneclick.status.refunded': '환불됨',
  'oneclick.status.refunded.detail': '입금이 환불되었습니다',
  'oneclick.status.failed': '실패',
  'oneclick.status.failed.detail': '스왑이 실패했습니다',
  'oneclick.status.pending.detail': '1Click이 입금을 감지할 때까지 대기 중...',
  'oneclick.status.knownDeposit': '입금 등록됨',
  'oneclick.status.knownDeposit.detail': '1Click이 입금 트랜잭션을 확인했습니다',
  'oneclick.status.pendingDeposit': '확인 대기 중',
  'oneclick.status.pendingDeposit.detail': '체인 확인 대기 중...',
  'oneclick.status.incomplete': '부분 입금',
  'oneclick.status.incomplete.detail': '견적 금액보다 적게 수신되었습니다',
  'oneclick.status.processing': '라우팅',
  'oneclick.status.processing.detail': '솔버가 스왑을 실행하고 있습니다...',
  'oneclick.status.unknown': '처리 중',
  'oneclick.refunded': '환불됨',
  'oneclick.failed': '실패',
  'oneclick.completed': '완료',
  'oneclick.field.amount': '금액:',
  'oneclick.field.time': '시간:',
  'oneclick.field.depositAddress': '입금:',
  'oneclick.field.originTx': '원본 Tx:',
  'oneclick.field.destinationTx': '대상 Tx:',
  'oneclick.field.received': '수신:'
}

export default oneclick
