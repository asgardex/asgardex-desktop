import { ProtocolPoolMessages } from '../types'

const protocolPool: ProtocolPoolMessages = {
  // General protocol pool keys
  'protocolPool.detail.title': 'Position du Pool de Protocole',
  'protocolPool.detail.availability': 'Pool de protocole actuellement non disponible',
  'protocolPool.detail.titleDeposit': 'Dépôt dans le Pool de Protocole',
  'protocolPool.detail.titleWithdraw': 'Retrait du Pool de Protocole',
  'protocolPool.detail.current.title': 'Valeur du dépôt',
  'protocolPool.detail.redeem.title': 'Valeur de rachat',
  'protocolPool.detail.percent': 'Croissance',
  'protocolPool.detail.totalGrowth': 'Croissance en USD',
  'protocolPool.detail.priceGrowth': 'Croissance du prix',
  'protocolPool.detail.assetAmount': "Quantité d'actif",
  'protocolPool.detail.daysLeft': 'Jours restants avant de pouvoir retirer',
  'protocolPool.detail.blocksLeft': 'Blocs restants avant de pouvoir retirer',
  'protocolPool.detail.warning': 'Déposer dans le pool de protocole réinitialisera la période de retrait',
  'protocolPool.info.max.withdraw.value': 'Valeur maximale à retirer',
  'protocolPool.info.max.balance': 'Solde maximum',
  'protocolPool.add.state.sending': "Envoi de la transaction d'ajout",
  'protocolPool.add.state.checkResults': 'Vérification des résultats de la transaction',
  'protocolPool.add.state.pending': 'Ajout au pool',
  'protocolPool.add.state.success': 'Ajout au pool réussi',
  'protocolPool.add.state.error': "Erreur lors de l'ajout au pool",
  'protocolPool.withdraw.state.sending': 'Envoi de la transaction de retrait',
  'protocolPool.withdraw.state.checkResults': 'Vérification des résultats de la transaction',
  'protocolPool.withdraw.state.pending': 'Retrait du pool',
  'protocolPool.withdraw.state.success': 'Retrait du pool réussi',
  'protocolPool.withdraw.state.error': 'Erreur lors du retrait du pool',
  // RUNE specific
  'protocolPool.rune.noAdded': "Vous n'avez pas ajouté au pool de runes",
  'protocolPool.rune.title': 'Position du Pool de Runes',
  // CACAO specific
  'protocolPool.cacao.noAdded': "Vous n'avez pas ajouté au pool de cacao",
  'protocolPool.cacao.title': 'Position du Pool de Cacao'
}

export default protocolPool
