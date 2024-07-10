import { CommonMessages } from '../types'

const common: CommonMessages = {
  'common.stats': 'Statistiques',
  'common.network': 'Réseau',
  'common.dex': 'Dex',
  'common.faqs': 'FAQ',
  'common.greeting': 'Bonjour {name}',
  'common.copyright': '©',
  'common.type': 'Taper',
  'common.address': 'Adresse',
  'common.addresses': 'Adresses',
  'common.thorname': 'THORName',
  'common.thornameRegistrationSpecifics': `Les THORNames permettent à quiconque d'enregistrer des adresses de portefeuille inter-chaînes sous forme d'une chaîne de 1 à 30 caractères hexadécimaux, y compris les caractères spéciaux -+. Les THORNames sont limités à 30 caractères, y compris ^[a-zA-Z0-9+-]+$.`,
  'common.thornameError': 'THORName non disponible',
  'common.mayaname': 'MAYAName',
  'common.owner': 'Propriétaire',
  'common.preferredAsset': 'Actif préféré',
  'common.expirationBlock': `Bloc d'expiration`,
  'common.aliasChain': 'Chaîne de pseudonyme',
  'common.aliasAddress': 'Adresse de pseudonyme',
  'common.expiry': 'Expiration',
  'common.isUpdate': 'Mettre à jour le nom THOR',
  'common.address.self': 'Moi',
  'common.to': 'À',
  'common.from': 'De',
  'common.filterValue': 'Filtrer les soldes vides',
  'common.amount': 'Montant',
  'common.coin': 'Coin',
  'common.collapseAll': 'Réduire tout',
  'common.expandAll': 'Développer tout',
  'common.password': 'Mot de passe',
  'common.memo': 'Mémo',
  'common.memos': 'Mémos',
  'common.date': 'Date',
  'common.refresh': 'Rafraîchir',
  'common.back': 'Retour',
  'common.general': 'Général',
  'common.advanced': 'Avancé',
  'common.privateData': 'Données privées',
  'common.remove': 'Supprimer',
  'common.keystore': 'Keystore',
  'common.keystorePassword': 'Keystore mot de passe',
  'common.ledger': 'Ledger',
  'common.phrase': 'Phrase de récupération',
  'common.submit': 'Valider',
  'common.confirm': 'Confirmer',
  'common.cancel': 'Annuler',
  'common.reject': 'Rejeter',
  'common.next': 'Suivant',
  'common.finish': 'Finir',
  'common.copy': 'Copier',
  'common.loading': 'Chargement…',
  'common.error': 'Erreur',
  'common.error.api.limit': "Dépassement de la limite du taux d'API",
  'common.test': 'Test',
  'common.change': 'Modifier',
  'common.wallet': 'Portefeuille',
  'common.history': 'Historique',
  'common.settings': 'Réglages',
  'common.asset': 'Actif',
  'common.assets': 'Actifs',
  'common.rune': '{dex}',
  'common.pool': 'Pool',
  'common.pool.inbound': 'Pool Inbound',
  'common.pools': 'Pools',
  'common.price': 'Prix',
  'common.price.rune': 'Prix du Rune',
  'common.price.cacao': 'Prix du Cacao',
  'common.transaction': 'Transaction',
  'common.transaction.short.rune': '{dex} tx',
  'common.transaction.short.asset': 'Actif tx',
  'common.viewTransaction': 'Afficher la transaction',
  'common.copyTxUrl': "Copier l'URL de la transaction",
  'common.trackTransaction': 'Suivre la transaction',
  'common.copyTxHash': "Copier l'URL de la hash",
  'common.fee': 'Frais',
  'common.feeRate': 'Taux de frais',
  'common.fee.nodeOperator': 'Frais de lopérateur de nœud',
  'common.fee.inbound': 'Inbound',
  'common.fee.inbound.rune': '{dex} inbound',
  'common.fee.inbound.asset': 'Actif inbound',
  'common.fee.outbound': 'Sortante',
  'common.fee.outbound.rune': '{dex} sortant',
  'common.fee.outbound.asset': 'Actif sortant',
  'common.fee.affiliate': 'Affilié',
  'common.fees': 'Frais',
  'common.fee.estimated': 'Frais estimé',
  'common.fees.estimated': 'Frais estimés',
  'common.max': 'Maximum',
  'common.min': 'Minimum',
  'common.search': 'Rechercher',
  'common.searchAsset': 'Rechercher un actif',
  'common.searchExample': 'Exemple de recherche pour chaîne non synthétique.ticker ex. btc.btc ou pour synth btc/btc',
  'common.excludeSynth': 'Exclure les Synth',
  'common.retry': 'Réessayer',
  'common.reload': 'Recharger',
  'common.action': 'Action',
  'common.add': 'Ajouter',
  'common.completeLp': 'compléter LP',
  'common.swap': 'Échanger',
  'common.lending': 'Prêt',
  'common.borrow': 'Emprunter',
  'common.repay': 'Rembourser',
  'common.collateral': 'Collatéral',
  'common.debt': 'Dette',
  'common.savers': 'Épargnants',
  'common.earn': 'Gagner',
  'common.liquidity': 'Liquidité',
  'common.withdraw': 'Retrait',
  'common.approve': 'Approuver',
  'common.accept': 'Accepter',
  'common.approve.checking': "Vérification de l'allocation pour {asset}",
  'common.approve.error': "Erreur pendant la vérification de l'allocation pour {asset}: {error}",
  'common.step': 'Étape {current}/{total}',
  'common.done': 'Terminé',
  'common.nodeAddress': 'Adresse du nœud',
  'common.providerAddress': 'Adresse du fournisseur',
  'common.tx.healthCheck': 'Vérification',
  'common.tx.sending': 'Envoi de la transaction',
  'common.tx.sendingAsset': 'Envoi de la transaction {assetTicker}',
  'common.tx.success': 'La transaction a été envoyée avec succès',
  'common.tx.success-info':
    "La transaction peut prendre un certain temps pour être confirmée (jusqu'à plusieurs minutes selon la chaîne)",
  'common.tx.checkResult': 'Vérifier le résultat',
  'common.tx.view': 'Voir la transaction {assetTicker}',
  'common.modal.confirmTitle': "Confirmer l'action",
  'common.value': 'Valeur',
  'common.manage': 'Gérer LP',
  'common.managePosition': 'Gérer la Position',
  'common.analytics': 'Analyse',
  'common.asset.base': 'Base',
  'common.asset.change': "Changement d'actif",
  'common.asset.quickSelect': 'Sélection rapide L1',
  'common.noResult': 'Aucun résultat',
  'common.rate': 'Taux',
  'common.tx.type.swap': 'Échange',
  'common.tx.type.donate': 'Don',
  'common.tx.type.refund': 'Remboursement',
  'common.tx.type.deposit': 'Dépôt',
  'common.tx.type.withdraw': 'Retrait',
  'common.detail': 'Détail',
  'common.details': 'Détails',
  'common.filter': 'Filtre',
  'common.all': 'Tout',
  'common.time.days': '{days} jours',
  'common.time.days.short': '{days}j',
  'common.time.month1': '1 mois',
  'common.time.month1.short': '1m',
  'common.time.months3': '3 mois',
  'common.time.months3.short': '3m',
  'common.time.year1': '1 année',
  'common.time.year1.short': '1a',
  'common.time.all': 'Tout',
  'common.time.all.short': 'Tout',
  'common.time.title': 'Temps',
  'common.inbound.time': 'Entrant',
  'common.outbound.time': 'Sortant',
  'common.streaming.time': 'Diffusion',
  'common.streaming.time.info': 'Temps estimé pour que cet échange en streaming soit complété',
  'common.totaltransaction.time': 'Temps total de la transaction',
  'common.confirmation.time': '{chain} Confirmation de chaîne',
  'common.theme.light': 'Mode clair',
  'common.theme.dark': 'Mode sombre',
  'common.volume24': 'Volume (24h)',
  'common.volume24.description': "Volume d'échanges, d'ajouts de liquidité, et de retraits, sur 24h",
  'common.informationMore': "Plus d'information",
  'common.balance': 'Solde',
  'common.balance.loading': 'Chargement du solde',
  'common.balances': 'Soldes',
  'common.custom': 'Personnaliser',
  'common.notsupported.fornetwork': 'Non pris en charge pour {network}',
  'common.recipient': 'Destinataire',
  'common.sender': 'Expéditeur',
  'common.legacy': 'Obsolète',
  'common.ledgerlive': 'Ledger Live',
  'common.metamask': 'MetaMask',
  'common.unknown': 'Inconnu'
}

export default common
