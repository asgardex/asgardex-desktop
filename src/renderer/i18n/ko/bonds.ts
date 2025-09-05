import { BondsMessages } from '../types'

const bonds: BondsMessages = {
  'bonds.node': '노드',
  'bonds.bond': '채권',
  'bonds.currentBond': '현재 채권',
  'bonds.bondProvider': '채권 제공자',
  'bonds.award': '보상',
  'bonds.status': '상태',
  'bonds.status.ready': '준비됨',
  'bonds.status.active': '활성',
  'bonds.status.standby': '대기 중',
  'bonds.status.disabled': '비활성화됨',
  'bonds.status.whitelisted': '화이트리스트에 등록됨',
  'bonds.nodes.error': '노드 데이터를 로드하는 동안 오류 발생',
  'bonds.node.add': '노드 추가',
  'bonds.node.enterMessage': '추적할 노드를 입력하세요',
  'bonds.validations.nodeAlreadyAdded': '노드가 이미 추가되었습니다',
  'bonds.node.removeMessage': '{node} 노드를 삭제하시겠습니까?',
  'bonds.validations.bondStatusActive': '활성 노드와의 연결 해제는 허용되지 않습니다',
  // TODO: Need Korean translation by native speaker
  'bonds.tooltip.removeFromWatchlist': 'Remove this bond provider from the watch list',
  'bonds.tooltip.addToWatchlist': 'Add this bond provider to the watch list'
}

export default bonds
