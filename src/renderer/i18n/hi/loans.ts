import { LoanMessages } from '../types'

const loan: LoanMessages = {
  'loan.noLoans': 'आपके पास कोई खुला हुआ ऋण नहीं है',
  'loan.openLoan': 'ऋण खोलें',
  'loan.closeLoan': 'ऋण बंद करें',
  'loan.detail.title': 'आपका खुला हुआ ऋण',
  'loan.detail.debt.current': 'वर्तमान ऋण',
  'loan.detail.debt.issued': 'जारी किया गया ऋण',
  'loan.detail.collateral.deposited': 'जमा की गई संपार्श्विक',
  'loan.detail.collateral.current': 'वर्तमान संपार्श्विक',
  'loan.detail.collateral.withdrawn': 'निकाली गई संपार्श्विक',
  'loan.detail.age': 'ऋण की अवधि',
  'loan.detail.lastRepay': 'ऋण की अंतिम पुनर्भुगतान',
  'loan.detail.repayed': 'भुगतान की गई राशि',
  'loan.detail.assetAmount': 'संपत्ति की राशि',
  'loan.detail.collaterizationRatio': 'संपार्श्विक अनुपात',
  'loan.info.max.loan.value': 'अधिकतम ऋण मूल्य',
  'loan.info.max.balance': 'अधिकतम शेष राशि',
  'loan.borrow.state.sending': 'ऋण खोलने का लेनदेन भेजा जा रहा है',
  'loan.borrow.state.checkResults': 'लेनदेन के परिणाम की जांच हो रही है',
  'loan.borrow.state.pending': 'ऋण बनाया जा रहा है',
  'loan.borrow.state.success': 'सफलतापूर्वक ऋण खोला गया',
  'loan.borrow.state.error': 'ऋण खोलने में त्रुटि',
  'loan.repay.state.sending': 'ऋण पुनर्भुगतान लेनदेन भेजा जा रहा है',
  'loan.repay.state.checkResults': 'लेनदेन के परिणाम की जांच हो रही है',
  'loan.repay.state.pending': 'ऋण का पुनर्भुगतान हो रहा है',
  'loan.repay.state.success': 'सफलतापूर्वक ऋण का पुनर्भुगतान हुआ',
  'loan.repay.state.error': 'ऋण का पुनर्भुगतान करने में त्रुटि'
}

export default loan
