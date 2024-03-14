import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain wurde vorübergehend angehalten.',
  'halt.trading': 'Der Handel ist vorübergehend für alle Pools gestoppt.',
  'halt.chain': '{chain} Chain op {dex} wurde vorübergehend gestoppt.',
  'halt.chains': '{chains} Chains wurden vorübergehend gestoppt.',
  'halt.chain.synth': 'Synthetische handel voor {chain} is niet beschikbaar terwijl {chain} is stopgezet',
  'halt.chain.trading': 'Der Handel für {chains} Chain(s) wurde vorübergehend gestoppt.',
  'halt.chain.pause':
    'Liquidity-Aktivitäten (Hinzufügen/Entfernen) wurden für {chains} Chain(s) vorübergehend gestoppt.',
  'halt.chain.pauseall': 'Liquidity-Aktivitäten (Hinzufügen/Entfernen) wurden für alle Chains vorübergehend gestoppt.'
}

export default halt
