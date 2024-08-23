import { LoanMessages } from '../types'

const loan: LoanMessages = {
  'loan.noLoans': 'Sie haben keine offenen Kredite',
  'loan.openLoan': 'Kredit aufnehmen',
  'loan.closeLoan': 'Kredit schließen',
  'loan.detail.title': 'Ihr offener Kredit',
  'loan.detail.debt.current': 'Aktuelle Schuld',
  'loan.detail.debt.issued': 'Ausgegebene Schuld',
  'loan.detail.collateral.deposited': 'Hinterlegte Sicherheit',
  'loan.detail.collateral.current': 'Aktuelle Sicherheit',
  'loan.detail.collateral.withdrawn': 'Sicherheit zurückgezogen',
  'loan.detail.age': 'Kreditalter',
  'loan.detail.lastRepay': 'Letzte Rückzahlung des Darlehens',
  'loan.detail.repayed': 'Zurückgezahlter Betrag',
  'loan.detail.assetAmount': 'Vermögensbetrag',
  'loan.detail.collaterizationRatio': 'Besicherungsquote',
  'loan.info.max.loan.value': 'Maximaler Kreditbetrag',
  'loan.info.max.balance': 'Maximaler Kontostand',
  'loan.borrow.state.sending': 'Krediteröffnungstransaktion wird gesendet',
  'loan.borrow.state.checkResults': 'Überprüfung der Transaktionsergebnisse',
  'loan.borrow.state.pending': 'Kredit wird erstellt',
  'loan.borrow.state.success': 'Erfolgreich Kredit aufgenommen',
  'loan.borrow.state.error': 'Fehler bei der Krediteröffnung',
  'loan.repay.state.sending': 'Rückzahlungstransaktion wird gesendet',
  'loan.repay.state.checkResults': 'Überprüfung der Transaktionsergebnisse',
  'loan.repay.state.pending': 'Kredit wird zurückgezahlt',
  'loan.repay.state.success': 'Erfolgreiche Kreditrückzahlung',
  'loan.repay.state.error': 'Fehler bei der Kreditrückzahlung'
}

export default loan
