import { ChainflipMessages } from '../types'

const chainflip: ChainflipMessages = {
  'chainflip.status.waiting': '예금 대기 중',
  'chainflip.status.receiving': '예금 수신 중',
  'chainflip.status.receiving.detail': '예금을 처리하는 중...',
  'chainflip.status.swapping': '교환 중',
  'chainflip.status.swapping.detail': 'Chainflip에서 교환 실행 중...',
  'chainflip.status.sending': '전송 중',
  'chainflip.status.sending.detail': '출금 거래 준비 중...',
  'chainflip.status.sent': '전송됨',
  'chainflip.status.sent.detail': '거래가 목적지로 전송됨',
  'chainflip.status.complete': '완료',
  'chainflip.status.complete.detail': '교환이 성공적으로 완료됨',
  'chainflip.status.failed': '실패',
  'chainflip.status.failed.detail': '교환 실패',
  'chainflip.status.processing': '처리 중',
  'chainflip.status.processing.detail': '거래 진행 중...',
  'chainflip.status.pending.detail': '블록체인 데이터 대기 중...',
  'chainflip.completed': '완료됨',
  'chainflip.field.amount': '금액:',
  'chainflip.field.time': '시간:',
  'chainflip.field.channelId': '채널 ID:',
  'chainflip.field.swapId': '교환 ID:',
  'chainflip.field.depositTx': '예금 Tx:',
  'chainflip.field.egressTx': '출금 Tx:'
}

export default chainflip