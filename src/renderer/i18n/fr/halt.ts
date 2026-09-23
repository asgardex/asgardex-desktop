import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain est temporairement interrompu. Utilisez {alternatives} pour les échanges.',
  'halt.trading':
    'L’échange sur {protocols} est temporairement interrompu. L’échange via {alternatives} reste disponible.',
  'halt.chain': 'La chaîne {chain} sur {dex} a été temporairement interrompue.',
  'halt.chains': 'Les chaînes {chains} sur {protocol} sont temporairement interrompues.',
  'halt.chain.trading': '{protocol} : échange temporairement interrompu pour {chains}.',
  'halt.chain.synth': "Le trading synthétique pour {chain} n'est pas disponible pendant que {chain} est arrêté",
  'halt.chain.pause':
    'Les activités de liquidité (ajouter/retirer) pour la(es) chaîne(s) {chains} sont temporairement désactivées.',
  'halt.chain.pauseall':
    'Les activités de liquidité (ajouter/retirer) pour toutes les chaînes ont été temporairement désactivées.',
  'halt.chain.pauseDeposits':
    'Les dépôts de liquidité (ajout) pour la(les) chaîne(s) {chains} ont été temporairement désactivés.',
  'halt.swap.routeImpaired': 'La route d’échange peut être altérée'
}

export default halt
