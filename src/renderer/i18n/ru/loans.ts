import { LoanMessages } from '../types'

const loan: LoanMessages = {
  'loan.noLoans': 'У вас нет открытых кредитов',
  'loan.openLoan': 'Открыть кредит',
  'loan.closeLoan': 'Закрыть кредит',
  'loan.detail.title': 'Ваш открытый кредит',
  'loan.detail.debt.current': 'Текущий долг',
  'loan.detail.debt.issued': 'Выпущенный долг',
  'loan.detail.collateral.deposited': 'Залог внесен',
  'loan.detail.collateral.current': 'Текущий залог',
  'loan.detail.collateral.withdrawn': 'Выведенное обеспечение',
  'loan.detail.age': 'Возраст кредита',
  'loan.detail.lastRepay': 'Последний возврат займа',
  'loan.detail.repayed': 'Погашенная сумма',
  'loan.detail.assetAmount': 'Сумма актива',
  'loan.detail.collaterizationRatio': 'Коэффициент Залогового Покрытия',
  'loan.info.max.loan.value': 'Максимальная сумма кредита',
  'loan.info.max.balance': 'Максимальный баланс',
  'loan.borrow.state.sending': 'Отправка транзакции открытия кредита',
  'loan.borrow.state.checkResults': 'Проверка результатов транзакции',
  'loan.borrow.state.pending': 'Создание кредита',
  'loan.borrow.state.success': 'Кредит успешно открыт',
  'loan.borrow.state.error': 'Ошибка при открытии кредита',
  'loan.repay.state.sending': 'Отправка транзакции погашения кредита',
  'loan.repay.state.checkResults': 'Проверка результатов транзакции',
  'loan.repay.state.pending': 'Погашение кредита',
  'loan.repay.state.success': 'Кредит успешно погашен',
  'loan.repay.state.error': 'Ошибка при погашении кредита'
}

export default loan
