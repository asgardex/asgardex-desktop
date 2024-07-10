import { LoanMessages } from '../types'

const loan: LoanMessages = {
  'loan.noLoans': "Vous n'avez aucun prêt ouvert",
  'loan.openLoan': 'Ouvrir un prêt',
  'loan.closeLoan': 'Fermer le prêt',
  'loan.detail.title': 'Votre prêt ouvert',
  'loan.detail.debt.title': 'Valeur de la dette',
  'loan.detail.collateral.title': 'Valeur de la garantie',
  'loan.detail.age': 'Âge du prêt',
  'loan.detail.repayed': 'Montant remboursé',
  'loan.detail.assetAmount': "Montant de l'actif",
  'loan.info.max.loan.value': 'Valeur maximale du prêt',
  'loan.info.max.balance': 'Solde maximum',
  'loan.borrow.state.sending': "Envoi de la transaction d'ouverture du prêt",
  'loan.borrow.state.checkResults': 'Vérification des résultats de la transaction',
  'loan.borrow.state.pending': "Création d'un prêt",
  'loan.borrow.state.success': 'Prêt ouvert avec succès',
  'loan.borrow.state.error': "Erreur lors de l'ouverture d'un prêt",
  'loan.repay.state.sending': 'Envoi de la transaction de remboursement du prêt',
  'loan.repay.state.checkResults': 'Vérification des résultats de la transaction',
  'loan.repay.state.pending': 'Remboursement du prêt',
  'loan.repay.state.success': 'Prêt remboursé avec succès',
  'loan.repay.state.error': 'Erreur lors du remboursement du prêt'
}

export default loan
