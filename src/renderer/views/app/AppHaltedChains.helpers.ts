import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'

import { DEFAULT_ENABLED_CHAINS } from '../../../shared/utils/chain'
import { MimirHalt } from '../../services/thorchain/types'

export const CHAINFLIP_LABEL = 'Chainflip'

export type ResolvedProtocolData = {
  protocol: Chain
  inboundHaltedChains: Chain[]
  mimirHalt: MimirHalt
  midgard: boolean
}

export const isProtocolGloballyHalted = ({ protocol, mimirHalt }: ResolvedProtocolData): boolean =>
  mimirHalt.haltGlobalTrading || (protocol === THORChain && mimirHalt.HALTTHORCHAIN)

/** True when this protocol cannot trade `chain` (mimir trading/chain halt or inbound halt). */
export const isProtocolChainTradingHalted = (
  { inboundHaltedChains, mimirHalt }: ResolvedProtocolData,
  chain: Chain
): boolean => {
  if (inboundHaltedChains.includes(chain)) return true
  if (mimirHalt[`HALT${chain}CHAIN`]) return true
  if (mimirHalt[`HALT${chain}TRADING`]) return true
  return false
}

/**
 * A protocol is a usable swap alternative only if it is not globally halted and can
 * trade every chain in scope. With no selected chains (pools overview), any per-chain
 * trading/chain halt disqualifies it — otherwise we would advertise "Maya still available"
 * next to "Maya trading halted for BTC, ETH, …".
 */
export const isProtocolUsableAsSwapAlternative = (data: ResolvedProtocolData, selectedChains?: Chain[]): boolean => {
  if (isProtocolGloballyHalted(data)) return false

  const chains =
    selectedChains && selectedChains.length > 0 ? selectedChains : (Object.keys(DEFAULT_ENABLED_CHAINS) as Chain[])

  return chains.every((chain) => !isProtocolChainTradingHalted(data, chain))
}

/**
 * Labels for the "still available" clause: always include Chainflip, plus THOR/MAYA
 * only when they can actually serve the current scope.
 */
export const getSwapAlternativeLabels = (
  resolvedProtocols: ResolvedProtocolData[],
  selectedChains?: Chain[]
): string[] => {
  const protocolLabels = resolvedProtocols
    .filter((p) => isProtocolUsableAsSwapAlternative(p, selectedChains))
    .map((p) => p.protocol)

  return [CHAINFLIP_LABEL, ...protocolLabels]
}
