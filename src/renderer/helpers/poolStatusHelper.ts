import { AnyAsset, Chain } from '@xchainjs/xchain-util'

import { THORChain } from '../../shared/utils/chainIds'
import { MimirHalt as MimirHaltMaya } from '../services/mayachain/types'
import { MimirHalt as MimirHaltThor } from '../services/thorchain/types'
import * as PoolHelper from './poolHelper'
import * as PoolHelperMaya from './poolHelperMaya'

/**
 * Why actions of a pool are limited, most severe first. Derived from the shared halt logic
 * (`MimirHalt` of `useMimirHalt` / `useMimirHaltMaya` + `disable*Actions` of `poolHelper` / `poolHelperMaya`):
 *
 * |           | SWAP | ADD | Source                                                                        |
 * |-----------|------|-----|-------------------------------------------------------------------------------|
 * | `unknown` | NO   | NO  | `haltStatusUnknown` of the shared halt hooks, or inbound addresses not loaded  |
 * | `chain`   | NO   | NO  | `disableAllActions` (`HALT{CHAIN}CHAIN`, protocol halt, inbound `halted`)     |
 * | `trading` | NO   | NO  | `disableTradingActions` (`HALT{CHAIN}TRADING`, `HALTTRADING`)                  |
 * | `lp`      | YES  | NO  | `PAUSELP{CHAIN}`, `PAUSELP`, `inbound_addresses.chain_lp_actions_paused`       |
 * | `deposit` | YES  | NO  | `disablePoolActions` per pool (`PAUSELPDEPOSIT-{CHAIN}-{SYMBOL}`, THOR only)   |
 */
export type PoolStatusKind = 'unknown' | 'chain' | 'trading' | 'lp' | 'deposit'

export type PoolStatus = {
  kind: PoolStatusKind
}

/** Halt data of THORChain or MAYAChain, `undefined` while it is loading, failed or stale */
export type PoolHaltData =
  | { protocol: typeof THORChain; mimirHalt: MimirHaltThor; haltedChains: Chain[]; pausedLpChains: Chain[] }
  | {
      protocol: Exclude<Chain, typeof THORChain>
      mimirHalt: MimirHaltMaya
      haltedChains: Chain[]
      pausedLpChains: Chain[]
    }

export const UNKNOWN_POOL_STATUS: PoolStatus = { kind: 'unknown' }

const getKind = (asset: AnyAsset, data: PoolHaltData): PoolStatusKind | undefined => {
  const { chain } = asset
  const { haltedChains, pausedLpChains } = data
  // `inbound_addresses` marks a chain as `halted` for a trading halt, too: mimir decides the label first,
  // `haltedChains` is checked last (so an inbound-only halt is still a `chain` halt)
  if (data.protocol === THORChain) {
    const { mimirHalt } = data
    if (PoolHelper.disableAllActions({ chain, haltedChains: [], mimirHalt })) return 'chain'
    if (PoolHelper.disableTradingActions({ chain, haltedChains: [], mimirHalt })) return 'trading'
    if (PoolHelper.disableAllActions({ chain, haltedChains, mimirHalt })) return 'chain'
    if (
      mimirHalt.pauseGlobalLp ||
      mimirHalt[`PAUSELP${chain}` as keyof MimirHaltThor] ||
      pausedLpChains.includes(chain)
    )
      return 'lp'
    if (PoolHelper.disablePoolActions({ asset, haltedChains, mimirHalt })) return 'deposit'
    return undefined
  }
  const { mimirHalt } = data
  if (PoolHelperMaya.disableAllActions({ chain, haltedChains: [], mimirHalt })) return 'chain'
  if (PoolHelperMaya.disableTradingActions({ chain, haltedChains: [], mimirHalt })) return 'trading'
  if (PoolHelperMaya.disableAllActions({ chain, haltedChains, mimirHalt })) return 'chain'
  if (PoolHelperMaya.disablePoolActions({ chain, haltedChains, mimirHalt }) || pausedLpChains.includes(chain))
    return 'lp'
  return undefined
}

/**
 * Status of a pool: `undefined` if all pool actions are available, `unknown` (fail closed) without halt data.
 */
export const getPoolStatus = (asset: AnyAsset, data: PoolHaltData | undefined): PoolStatus | undefined => {
  if (!data) return UNKNOWN_POOL_STATUS
  const kind = getKind(asset, data)
  return kind ? { kind } : undefined
}

/** Swap is unavailable for halted chains, halted trading or an unknown status */
export const isSwapDisabled = (status?: PoolStatus): boolean =>
  status?.kind === 'chain' || status?.kind === 'trading' || status?.kind === 'unknown'

/** Add (deposit) is unavailable for any limited pool or an unknown status */
export const isAddDisabled = (status?: PoolStatus): boolean => status !== undefined
