import { TransactionMessages } from '../types'

const transaction: TransactionMessages = {
  'transaction.status.complete': '완료',
  'transaction.status.pending': '대기 중',
  'transaction.status.observing': '관찰 중',
  'transaction.status.confirming': '확인 중 ({time} 남음)',
  'transaction.status.confirming.simple': '확인 중',
  'transaction.status.finalising': '완료 중',
  'transaction.status.swapping': '교환 중',
  'transaction.status.streaming': '스트리밍 ({current}/{total})',
  'transaction.status.outbound': '아웃바운드',
  'transaction.status.outbound.delay': '아웃바운드 지연 ({time} 남음)',
  'transaction.stage.observed': '관찰됨',
  'transaction.stage.confirmed': '확인됨',
  'transaction.stage.finalised': '완료됨',
  'transaction.stage.swapped': '교환됨',
  'transaction.stage.outbound': '아웃바운드',
  'transaction.progress.summary': '총 {total}단계 중 {completed}단계 완료'
}

export default transaction
