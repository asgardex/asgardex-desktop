import { SwapMessages } from '../types'

const swap: SwapMessages = {
  'swap.state.sending': '트랜잭션 전송 중',
  'swap.state.pending': '스왑 중',
  'swap.state.success': '스왑 성공',
  'swap.state.error': '스왑 오류',
  'swap.input': '입력',
  'swap.output': '출력',
  'swap.info.max.balance': '총 자산 잔액 ({balance})',
  'swap.info.max.balanceMinusFee': '총 자산 잔액 ({balance})에서 예상 스왑 수수료 ({fee})를 뺀 금액',
  'swap.slip.title': '슬리피지',
  'swap.aggregator.betterReturn': '더 나은 수익...',
  'swap.aggregator.fasterReturn': '더 빠른 수익...',
  'swap.slip.tolerance': '슬리피지 허용 범위',
  'swap.slip.tolerance.info':
    '퍼센트가 높을수록 더 많은 슬리피지를 허용하게 됩니다. 더 큰 슬리피지 허용 범위는 스왑이 중단되지 않도록 예상 수수료를 포함한 더 넓은 범위를 포함합니다.',
  'swap.streaming.interval': '간격',
  'swap.streaming.title': '스트리밍 상태',
  'swap.streaming.interval.info': '스왑 간의 간격, 10블록은 1분 간격입니다.',
  'swap.streaming.quantity': '수량',
  'swap.streaming.quantity.info': '간격당 전체적으로 수행되는 미니 스왑의 수량',
  'swap.errors.amount.balanceShouldCoverChainFee':
    '트랜잭션 수수료 {fee}는 잔액으로 충당되어야 합니다 (현재 {balance}).',
  'swap.errors.amount.outputShouldCoverChainFee':
    '아웃바운드 수수료 {fee}는 수신 금액으로 충당되어야 합니다 (현재 {amount}).',
  'swap.errors.amount.thornodeQuoteError': '{error} : 슬리피지 또는 입력 금액을 조정하세요.',
  'swap.note.lockedWallet': '스왑을 하려면 지갑을 잠금 해제해야 합니다.',
  'swap.note.nowallet': '스왑을 하려면 지갑을 생성하거나 가져오세요.',
  'swap.errors.asset.missingSourceAsset': '소스 자산이 없습니다.',
  'swap.errors.asset.missingTargetAsset': '타겟 자산이 없습니다.',
  'swap.errors.pool.notAvailable': '풀을 사용할 수 없습니다 {pool}',
  'swap.min.amount.info': '인바운드 및 아웃바운드 트랜잭션의 모든 수수료를 충당하기 위한 최소 스왑 금액입니다.',
  'swap.min.result.info':
    '선택한 {tolerance}% 슬리피지 허용 범위를 기반으로 스왑이 보호됩니다. 가격이 {tolerance}% 이상 불리하게 변할 경우 스왑 트랜잭션은 확인 전에 되돌려집니다.',
  'swap.min.result.protected': '보호된 스왑 결과'
}

export default swap
