import { LoanMessages } from '../types'

const loan: LoanMessages = {
  'loan.noLoans': "You don't have any open loans",
  'loan.openLoan': 'Open Loan',
  'loan.closeLoan': 'Close Loan',
  'loan.detail.title': 'Your open loan',
  'loan.detail.debt.title': 'Debt value',
  'loan.detail.collateral.title': 'Collateral value',
  'loan.detail.age': 'Loan age',
  'loan.detail.repayed': 'Amount repayed',
  'loan.detail.assetAmount': 'Asset Amount',
  'loan.info.max.loan.value': 'Max value to loan',
  'loan.info.max.balance': 'Max balance',
  'loan.borrow.state.sending': 'Sending loan open transaction',
  'loan.borrow.state.checkResults': 'Checking transaction results',
  'loan.borrow.state.pending': 'Creating a loan',
  'loan.borrow.state.success': 'Successful loan opened',
  'loan.borrow.state.error': 'Error opening a loan',
  'loan.repay.state.sending': 'Sending repay loan transaction',
  'loan.repay.state.checkResults': 'Checking transaction results',
  'loan.repay.state.pending': 'Repaying loan',
  'loan.repay.state.success': 'Successful loan repay',
  'loan.repay.state.error': 'Error repaying loan'
}

export default loan
