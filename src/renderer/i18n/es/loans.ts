import { LoanMessages } from '../types'

const loan: LoanMessages = {
  'loan.noLoans': 'No tienes ningún préstamo abierto',
  'loan.openLoan': 'Abrir Préstamo',
  'loan.closeLoan': 'Cerrar Préstamo',
  'loan.detail.title': 'Tu préstamo abierto',
  'loan.detail.debt.title': 'Valor de la deuda',
  'loan.detail.collateral.title': 'Valor de la garantía',
  'loan.detail.age': 'Antigüedad del préstamo',
  'loan.detail.repayed': 'Cantidad reembolsada',
  'loan.detail.assetAmount': 'Cantidad de activos',
  'loan.info.max.loan.value': 'Valor máximo a prestar',
  'loan.info.max.balance': 'Saldo máximo',
  'loan.borrow.state.sending': 'Enviando transacción de apertura de préstamo',
  'loan.borrow.state.checkResults': 'Verificando los resultados de la transacción',
  'loan.borrow.state.pending': 'Creando un préstamo',
  'loan.borrow.state.success': 'Préstamo abierto con éxito',
  'loan.borrow.state.error': 'Error al abrir un préstamo',
  'loan.repay.state.sending': 'Enviando transacción de reembolso de préstamo',
  'loan.repay.state.checkResults': 'Verificando los resultados de la transacción',
  'loan.repay.state.pending': 'Reembolsando préstamo',
  'loan.repay.state.success': 'Préstamo reembolsado con éxito',
  'loan.repay.state.error': 'Error al reembolsar el préstamo'
}

export default loan
