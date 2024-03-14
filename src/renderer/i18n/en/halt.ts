import { HaltMessages } from '../types'

const halt: HaltMessages = {
  'halt.thorchain': 'THORChain is halted temporarily.',
  'halt.trading': 'Trade has been halted for all pools temporarily.',
  'halt.chain': '{chain} chain on {dex} has been halted temporarily.',
  'halt.chain.synth': 'Synthetic trading for {chain} is not available while {chain} is halted',
  'halt.chains': '{chains} chains have been halted temporarily.',
  'halt.chain.trading': 'Trade has been halted for {chains} chain(s) temporarily.',
  'halt.chain.pause': 'Liquidity activities (add/remove) for {chains} chain(s) have been disabled temporarily.',
  'halt.chain.pauseall': 'Liquidity activities (add/remove) for all chains have been disabled temporarily.'
}

export default halt
