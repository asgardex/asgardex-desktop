import type { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import { AnyAsset, Chain } from '@xchainjs/xchain-util'

import { THORChain } from '../../shared/utils/chainIds'
import { MimirHalt as MimirHaltMaya } from '../services/mayachain/types'
import { MimirHalt } from '../services/thorchain/types'
import * as PoolHelpers from './poolHelper'
import * as PoolHelpersMaya from './poolHelperMaya'

export type ProtocolTradingHaltState = {
  thor: {
    haltedChains: Chain[]
    mimirHalt: MimirHalt
  }
  maya: {
    haltedChains: Chain[]
    mimirHalt: MimirHaltMaya
  }
}

const isThorUnquotableForChain = (chain: Chain, haltedChains: Chain[], mimirHalt: MimirHalt): boolean =>
  PoolHelpers.disableAllActions({ chain, haltedChains, mimirHalt }) ||
  PoolHelpers.disableTradingActions({ chain, haltedChains, mimirHalt })

/** TCY lives on THORChain and has its own trading halt (`HALTTCYTRADING`) */
const isTcyAsset = (asset: AnyAsset): boolean => asset.chain === THORChain && asset.ticker === 'TCY'

const isMayaUnquotableForChain = (chain: Chain, haltedChains: Chain[], mimirHalt: MimirHaltMaya): boolean =>
  PoolHelpersMaya.disableAllActions({ chain, haltedChains, mimirHalt }) ||
  PoolHelpersMaya.disableTradingActions({ chain, haltedChains, mimirHalt })

/**
 * True when THOR/MAYA cannot quote a swap for this asset pair because trading
 * (or the whole chain/protocol) is halted for the source or destination chain.
 * Chainflip / OneClick are never filtered here.
 */
export const isProtocolTradingHaltedForAssets = (
  protocol: Protocol,
  sourceAsset: AnyAsset,
  targetAsset: AnyAsset,
  haltState: ProtocolTradingHaltState
): boolean => {
  if (protocol === 'Thorchain') {
    const { haltedChains, mimirHalt } = haltState.thor
    return (
      isThorUnquotableForChain(sourceAsset.chain, haltedChains, mimirHalt) ||
      isThorUnquotableForChain(targetAsset.chain, haltedChains, mimirHalt) ||
      ((isTcyAsset(sourceAsset) || isTcyAsset(targetAsset)) && mimirHalt.HALTTCYTRADING === true)
    )
  }

  if (protocol === 'Mayachain') {
    const { haltedChains, mimirHalt } = haltState.maya
    return (
      isMayaUnquotableForChain(sourceAsset.chain, haltedChains, mimirHalt) ||
      isMayaUnquotableForChain(targetAsset.chain, haltedChains, mimirHalt)
    )
  }

  return false
}

/**
 * Drop THOR/MAYA from the aggregator protocol list when the pair is trading-halted
 * on that protocol, so estimateSwap never calls a known-dead route.
 */
export const filterQuotableProtocols = (
  protocols: Protocol[],
  sourceAsset: AnyAsset,
  targetAsset: AnyAsset,
  haltState: ProtocolTradingHaltState
): Protocol[] =>
  protocols.filter((protocol) => !isProtocolTradingHaltedForAssets(protocol, sourceAsset, targetAsset, haltState))

/**
 * BTC Taproot (bech32m). Mainnet is bc1p, testnet tb1p, regtest bcrt1p.
 * Compared case-insensitively because a pasted address may be upper case.
 */
export const isBtcTaprootAddress = (address: string | undefined | null): boolean => {
  const normalized = (address ?? '').trim().toLowerCase()
  return normalized.startsWith('bc1p') || normalized.startsWith('tb1p') || normalized.startsWith('bcrt1p')
}

/**
 * MAYAChain loses funds sent to or from a BTC Taproot address.
 * THORChain, Chainflip, and NEAR Intents still quote that route.
 */
export const dropMayachainForBtcTaproot = (
  protocols: Protocol[],
  sourceAddress: string,
  destinationAddress: string
): Protocol[] => {
  if (!isBtcTaprootAddress(sourceAddress) && !isBtcTaprootAddress(destinationAddress)) return protocols
  return protocols.filter((protocol) => protocol !== 'Mayachain')
}

/**
 * True when a swap through `protocol` has to be disabled for one of `chains` (source / target chain).
 * Each protocol is judged by its *own* halt state (`HALTTHORCHAIN` is THORChain's, `HALTMAYACHAIN` MAYAChain's):
 * feeding THORChain's mimir to MAYAChain swaps hides MAYA halts and shows THOR halts on MAYA.
 */
export const isSwapDisabledForChains = ({
  protocol,
  chains,
  haltedChains,
  mimirHalt
}: {
  protocol: 'Thorchain' | 'Mayachain'
  chains: Chain[]
  haltedChains: Chain[]
  /** Halt state of `protocol` */
  mimirHalt: MimirHalt | MimirHaltMaya
}): boolean =>
  chains.some((chain) =>
    protocol === 'Thorchain'
      ? isThorUnquotableForChain(chain, haltedChains, mimirHalt as MimirHalt)
      : isMayaUnquotableForChain(chain, haltedChains, mimirHalt as MimirHaltMaya)
  )
