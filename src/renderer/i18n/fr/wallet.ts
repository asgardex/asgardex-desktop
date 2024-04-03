import { WalletMessages } from '../types'

const wallet: WalletMessages = {
  'wallet.name': 'Nom du portefeuille',
  'wallet.name.maxChars': 'Max. {max} caractères',
  'wallet.name.error.empty': 'Veuillez entrer un nom pour votre portefeuille',
  'wallet.name.error.duplicated': 'Le nom existe déjà, veuillez utiliser un autre nom.',
  'wallet.name.error.rename': 'Erreur lors du changement de nom du portefeuille',
  'wallet.nav.deposits': 'Dépots',
  'wallet.nav.bonds': 'Cautions',
  'wallet.nav.poolshares': 'Quote-part',
  'wallet.nav.savers': 'Épargnants',
  'wallet.column.name': 'Nom',
  'wallet.column.ticker': 'Ticker',
  'wallet.action.send': 'Envoyer',
  'wallet.action.receive': 'Recevoir',
  'wallet.action.receive.title': 'Recevoir du {asset}',
  'wallet.action.forget': 'Supprimer',
  'wallet.action.unlock': 'Déverrouiller',
  'wallet.action.connect': 'Connecter',
  'wallet.action.import': 'Importer',
  'wallet.action.create': 'Créer',
  'wallet.action.deposit': 'Déposer',
  'wallet.balance.total.poolAssets': 'Solde total des actifs en pools',
  'wallet.balance.total.poolAssets.info':
    'Le solde total comprend les soldes des actifs disponibles dans les pools de THORChain uniquement. Les pools sont une source de vérité pour déterminer les prix chez THORChain.',
  'wallet.shares.total': 'Valeur totale',
  'wallet.connect.instruction': 'Veuillez connecter votre portefeuille',
  'wallet.lock.label': 'Verrouiller le portefeuille',
  'wallet.unlock.label': 'Déverrouiller le portefeuille',
  'wallet.unlock.title': 'Déverrouiller "{name}"',
  'wallet.unlock.instruction': 'Veuillez déverrouiller votre portefeuille',
  'wallet.unlock.password': 'Entrez votre phrase de récupération',
  'wallet.unlock.error':
    'Impossible de déverrouiller le portefeuille. Veuillez vérifier votre mot de passe et réessayez',
  'wallet.imports.keystore.select': 'Sélectionner le fichier keystore',
  'wallet.imports.keystore.title': 'Choisir le fichier à uploader',
  'wallet.imports.phrase.title': 'Veuillez entrer la phrase de récupération avec un seul espace entre les mots',
  'wallet.imports.wallet': 'Importer un portefeuille existant',
  'wallet.imports.enterphrase': 'Entrez la phrase de récupération',
  'wallet.imports.error.instance': 'Impossible de créer une instance du Client',
  'wallet.imports.error.keystore.load': 'Clé privée incorrecte',
  'wallet.imports.error.keystore.import': "Erreur lors de l'import des clés des portefeuilles",
  'wallet.imports.error.ledger.import': "Erreur lors de la tentative d'import des comptes Ledger",
  'wallet.imports.error.keystore.password': 'Mot de passe incorrect',
  'wallet.phrase.error.valueRequired': 'La phrase de récupération est requise',
  'wallet.phrase.error.invalid': 'Phrase de récupération incorrecte',
  'wallet.phrase.error.import': "Erreur lors de l'importation de la phrase de récupération",
  'wallet.imports.error.phrase.empty': 'Importez un portefeuille existant contenant des fonds',
  'wallet.txs.history': 'Historique des transactions',
  'wallet.txs.history.disabled': "L'historique des transactions pour {chain} a été désactivé temporairement.",
  'wallet.create.copy.phrase': 'Copiez la phrase ci-dessous',
  'wallet.create.error.phrase.empty': "Créez un nouveau portefeuille, et l'alimenter en fonds",
  'wallet.add.another': 'Ajouter un autre portefeuille',
  'wallet.add.label': 'Ajouter un portefeuille',
  'wallet.change.title': 'Changer de portefeuille',
  'wallet.change.error': 'Erreur lors du changement de portefeuille',
  'wallet.selected.title': 'Portefeuille sélectionné',
  'wallet.create.title': 'Créer un nouveau portefeuille',
  'wallet.create.enter.phrase': 'Entrez la phrase correctement',
  'wallet.create.error.phrase': 'Sauvegardez votre phrase en toute sécurité et saisissez-la correctement',
  'wallet.create.words.click': 'Cliquez sur le mot dans le bon ordre',
  'wallet.create.creating': 'Création du portefeuille',
  'wallet.create.error': "Erreur lors de la sauvegarde d'une phrase",
  'wallet.receive.address.error': 'Aucune adresse disponible pour recevoir des fonds',
  'wallet.receive.address.errorQR': "Erreur lors de l'affichage du QR code : {error}",
  'wallet.remove.label': 'Supprimer le portefeuille',
  'wallet.remove.label.title': 'Êtes-vous sûr de vouloir oublier "{name}"?',
  'wallet.remove.label.description':
    'Vous ne pouvez pas annuler cette action et devrez recréer votre portefeuille à partir de votre phrase de récupération.',
  'wallet.send.success': 'Transaction réussie.',
  'wallet.send.error': 'Erreur de transaction.',
  'wallet.send.fastest': 'Très rapide',
  'wallet.send.fast': 'Rapide',
  'wallet.send.affiliateTracking': `Mémo de swap détecté, frais d'affiliation de 10 points de base appliqués`,
  'wallet.send.notAllowed': 'Non autorisé',
  'wallet.send.average': 'Normal',
  'wallet.send.max.doge':
    "Valeur calculée max. basée sur des frais estimés, qui peuvent être incorrects pour DOGE de temps à autre. En cas de message d'erreur 'Solde insuffisant pour la transaction', consultez https://blockchair.com/dogecoin/transactions pour obtenir une moyenne des derniers frais et essayez de la déduire de votre solde avant d'envoyer une transaction.",
  'wallet.errors.balancesFailed': 'Échec lors du chargement des soldes. {errorMsg}',
  'wallet.errors.asset.notExist': 'Aucun {asset}',
  'wallet.errors.address.empty': "L'adresse ne peut être vide",
  'wallet.errors.address.invalid': "L'adresse est incorrecte",
  'wallet.errors.address.inbound': 'Attention adresse entrante détectée',
  'wallet.errors.address.couldNotFind': "Impossible de trouver l'adresse de la pool {pool}",
  'wallet.errors.amount.shouldBeNumber': 'Le montant doit être un nombre',
  'wallet.errors.amount.shouldBeGreaterThan': 'Le montant doit être supérieur à {amount}',
  'wallet.errors.amount.shouldBeGreaterOrEqualThan': 'Le montant doit être égal ou supérieur à {amount}',
  'wallet.errors.amount.shouldBeLessThanBalance': 'Le montant doit être inférieur à votre solde',
  'wallet.errors.amount.shouldBeLessThanBalanceAndFee': 'Le montant doit être inférieur à votre solde moins les frais',
  'wallet.errors.fee.notCovered': 'Les frais ne sont pas couverts par votre solde de ({balance})',
  'wallet.errors.invalidChain': 'Chaîne non valide : {chain}',
  'wallet.errors.memo.max': 'La longueur du mémo ne peut pas être supérieure à {max}',
  'wallet.password.confirmation.title': 'Confirmation du mot de passe',
  'wallet.password.confirmation.description': 'Veuillez saisir le mot de passe de votre portefeuille.',
  'wallet.password.confirmation.pending': 'Validation du mot de passe',
  'wallet.password.empty': 'Veuillez entrer un mot de passe',
  'wallet.password.confirmation.error': 'Le mot de passe est erroné',
  'wallet.password.repeat': 'Répétez le mot de passe',
  'wallet.password.mismatch': 'Non-concordance des mots de passe',
  'wallet.validations.lessThen': 'Devrait être inférieur à {value}',
  'wallet.validations.graterThen': 'Devrait être supérieur à {value}',
  'wallet.validations.shouldNotBeEmpty': 'Ne devrait pas être vide',
  'wallet.ledger.verifyAddress.modal.title': "Vérification de l'adresse Ledger",
  'wallet.ledger.verifyAddress.modal.description': "Vérifiez l'adresse {address} sur votre appareil"
}

export default wallet
