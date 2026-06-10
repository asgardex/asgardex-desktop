import { OneClickMessages } from '../types'

const oneclick: OneClickMessages = {
  'oneclick.status.refunded': 'Remboursé',
  'oneclick.status.refunded.detail': 'Le dépôt a été remboursé',
  'oneclick.status.failed': 'Échoué',
  'oneclick.status.failed.detail': "L'échange a échoué",
  'oneclick.status.pending.detail': 'En attente de la détection du dépôt par 1Click...',
  'oneclick.status.knownDeposit': 'Dépôt enregistré',
  'oneclick.status.knownDeposit.detail': '1Click a reconnu votre transaction de dépôt',
  'oneclick.status.pendingDeposit': 'En attente de confirmation',
  'oneclick.status.pendingDeposit.detail': 'En attente des confirmations de la chaîne...',
  'oneclick.status.incomplete': 'Dépôt partiel',
  'oneclick.status.incomplete.detail': 'Le montant reçu est inférieur au montant coté',
  'oneclick.status.processing': 'Routage',
  'oneclick.status.processing.detail': "Les solveurs exécutent l'échange...",
  'oneclick.status.unknown': 'En cours',
  'oneclick.refunded': 'Remboursé',
  'oneclick.failed': 'Échoué',
  'oneclick.completed': 'Terminé',
  'oneclick.field.amount': 'Montant :',
  'oneclick.field.time': 'Durée :',
  'oneclick.field.depositAddress': 'Dépôt :',
  'oneclick.field.originTx': "Tx d'origine :",
  'oneclick.field.destinationTx': 'Tx de destination :',
  'oneclick.field.received': 'Reçu :'
}

export default oneclick
