import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain is halted temporarily. Use {alternatives} for swaps.',
  'halt.trading': 'Trading on {protocols} is halted temporarily. Swap via {alternatives} is still available.',
  'halt.chain': '{chain} chain on {dex} has been halted temporarily.',
  'halt.chain.synth': 'Synthetic trading for {chain} is not available while {chain} is halted',
  'halt.chains': '{chains} chains on {protocol} have been halted temporarily.',
  'halt.chain.trading': 'Trade has been halted for {chains} chain(s) temporarily.',
  'halt.chain.pause': 'Liquidity activities (add/remove) for {chains} chain(s) have been disabled temporarily.',
  'halt.chain.pauseall': 'Liquidity activities (add/remove) for all chains have been disabled temporarily.',
  'halt.chain.pauseDeposits':
    'Liquidity deposits (add) for {chains} chain(s) on {protocol} have been disabled temporarily.',
  'halt.swap.routeImpaired': 'Swap route may be impaired'
}

export default halt
