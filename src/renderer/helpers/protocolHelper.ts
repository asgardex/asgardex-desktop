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

/** Static route score. Signer set, open entry, and whether a swap can be paid to a shared vault. */
export const decentralizationByProtocol: Partial<Record<Protocol, { percent: number; detail: string }>> = {
  Thorchain: {
    percent: 90,
    detail: '95 active nodes, open bond, threshold vault. You pay the inbound address with a memo.'
  },
  Mayachain: {
    percent: 73,
    detail: 'Same inbound vault as THORChain, with a smaller node set. No per-swap address is issued first.'
  },
  Chainflip: {
    percent: 58,
    detail:
      'Permissionless validators, but each swap needs a deposit channel. If that channel cannot be opened, the swap is not served.'
  },
  OneClick: {
    percent: 25,
    detail: 'A solver fills a deposit address from the 1Click API. There is no vault you can pay directly.'
  }
}

/** THOR/MAYA use streaming + slip-tolerance controls; Chainflip/OneClick do not. */
export const isDexStreamingProtocol = (protocol: Protocol | null | undefined): boolean =>
  protocol === 'Thorchain' || protocol === 'Mayachain'
