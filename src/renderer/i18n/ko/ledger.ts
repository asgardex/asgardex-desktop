import { LedgerMessages } from '../types'

const ledger: LedgerMessages = {
  'ledger.title': '원장',
  'ledger.title.sign': '원장으로 서명 중',
  'ledger.sign': '기기에서 거래를 서명하려면 "다음"을 클릭하세요.',
  'ledger.blindsign':
    '원장 기기에서 {chain} 애플리케이션을 위해 "스마트 계약 데이터" 또는 "블라인드 서명"을 활성화해야 합니다.',
  'ledger.needsconnected': '원장 기기가 연결되어 있고 {chain} 애플리케이션이 실행 중인지 확인하세요.',
  'ledger.add.device': '원장 추가',
  'ledger.error.nodevice': '연결된 기기가 없습니다',
  'ledger.error.inuse': '원장이 다른 앱에서 이미 사용 중입니다',
  'ledger.error.appnotopened': '원장 앱이 열려 있지 않습니다',
  'ledger.error.noapp': '원장 앱이 열려 있지 않습니다. 원장에서 적절한 앱을 열어주세요.',
  'ledger.error.getaddressfailed': '원장에서 주소를 가져오는 데 실패했습니다',
  'ledger.error.signfailed': '원장으로 거래 서명에 실패했습니다',
  'ledger.error.sendfailed': '원장으로 거래 전송에 실패했습니다',
  'ledger.error.depositfailed': '원장으로 입금 거래 전송에 실패했습니다',
  'ledger.error.invalidpubkey': '원장 사용을 위한 공개 키가 유효하지 않습니다.',
  'ledger.error.invaliddata': '유효하지 않은 데이터입니다.',
  'ledger.error.invalidresponse': '원장을 사용하여 거래를 전송한 후 유효하지 않은 응답이 반환되었습니다.',
  'ledger.error.rejected': '원장에서 작업이 거부되었습니다.',
  'ledger.error.timeout': '원장에서 작업을 처리하는 데 시간이 초과되었습니다.',
  'ledger.error.notimplemented': '원장을 위한 작업이 구현되지 않았습니다.',
  'ledger.error.denied': '원장 사용이 거부되었습니다',
  'ledger.error.unknown': '알 수 없는 오류',
  'ledger.notsupported': '{chain}에 대한 원장 지원이 없습니다.',
  'ledger.notaddedorzerobalances': '원장 {chain}이 연결되지 않았거나 잔액이 없습니다.',
  'ledger.deposit.oneside': '현재 원장은 하나의 자산 측면만 지원됩니다.',
  'ledger.legacyformat.note':
    '원장은 모든 출력 주소를 "레거시" 형식으로 표시하지만 "CashAddr" 형식으로는 표시하지 않습니다.',
  'ledger.legacyformat.show': '주소 표시',
  'ledger.legacyformat.hide': '주소 숨기기'
}

export default ledger
