import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain wurde vorübergehend angehalten. Nutze {alternatives} zum Tauschen.',
  'halt.trading':
    'Der Handel auf {protocols} ist vorübergehend gestoppt. Tausch über {alternatives} ist weiterhin verfügbar.',
  'halt.chain': '{chain} Chain auf {dex} wurde vorübergehend gestoppt.',
  'halt.chains': '{chains} Ketten auf {protocol} wurden vorübergehend gestoppt.',
  'halt.chain.synth': 'Synthetischer Handel für {chain} ist nicht verfügbar, während {chain} gestoppt ist.',
  'halt.chain.trading': '{protocol}: Handel für {chains} vorübergehend gestoppt.',
  'halt.chain.pause':
    'Liquidity-Aktivitäten (Hinzufügen/Entfernen) wurden für {chains} Chain(s) vorübergehend gestoppt.',
  'halt.chain.pauseall': 'Liquidity-Aktivitäten (Hinzufügen/Entfernen) wurden für alle Chains vorübergehend gestoppt.',
  'halt.chain.pauseDeposits':
    'Einlagen für Liquidität (Hinzufügen) für {chains} Kette(n) wurden vorübergehend deaktiviert.',
  'halt.swap.routeImpaired': 'Tausch-Route ist möglicherweise eingeschränkt'
}

export default halt
