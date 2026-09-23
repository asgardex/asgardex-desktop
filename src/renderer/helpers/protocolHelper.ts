import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'

export const chainToProtocol = {
  [THORChain]: 'THORChain',
  [MAYAChain]: 'MAYAChain'
}

export const protocolMapping = {
  Thorchain: 'THORChain',
  Mayachain: 'MAYAChain',
  Chainflip: 'Chainflip',
  OneClick: 'NEAR Intents'
}

/** THOR/MAYA use streaming + slip-tolerance controls; Chainflip/OneClick do not. */
export const isDexStreamingProtocol = (protocol: Protocol | null | undefined): boolean =>
  protocol === 'Thorchain' || protocol === 'Mayachain'
