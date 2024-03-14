import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain est temporairement interrompu.',
  'halt.trading': 'L’échange sur toutes les pools de liquidité est temporairement interrompu.',
  'halt.chain': 'La chaîne {chain} sur {dex} a été temporairement interrompue.',
  'halt.chains': 'Les chaînes {chains} sont temporairement interrompues.',
  'halt.chain.trading': 'L’échange pour {chains} est temporairement interrompu.',
  'halt.chain.synth': "Le trading synthétique pour {chain} n'est pas disponible pendant que {chain} est arrêté",
  'halt.chain.pause':
    'Les activités de liquidité (ajouter/retirer) pour la(es) chaîne(s) {chains} sont temporairement désactivées.',
  'halt.chain.pauseall':
    'Les activités de liquidité (ajouter/retirer) pour toutes les chaînes ont été temporairement désactivées.'
}

export default halt
