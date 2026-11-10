import { AnyAsset, Chain } from '@xchainjs/xchain-util'

import { THORChain } from '../../shared/utils/chainIds'
import { getMimirStatus as getMimirStatusThor } from '../hooks/useMimirHalt'
import { getMimirStatus as getMimirStatusMaya } from '../hooks/useMimirHaltMaya'

/**
 * Why actions of a pool are limited, most severe first:
 *
 * |           | SWAP | ADD | Source                                                              |
 * |-----------|------|-----|---------------------------------------------------------------------|
 * | `chain`   | NO   | NO  | `HALT{CHAIN}CHAIN`, `HALTTHORCHAIN` / `HALTMAYACHAIN`, `inbound_addresses.halted` |
 * | `trading` | NO   | NO  | `HALT{CHAIN}TRADING`, `HALTTRADING`                                 |
 * | `lp`      | YES  | NO  | `PAUSELP{CHAIN}`, `PAUSELP`, `inbound_addresses.chain_lp_actions_paused` |
 * | `deposit` | YES  | NO  | `PAUSELPDEPOSIT-{CHAIN}-{SYMBOL}` (one pool only)                    |
 */
export type PoolStatusKind = 'chain' | 'trading' | 'lp' | 'deposit'

export type PoolStatus = {
  kind: PoolStatusKind
  /** Outbound txs of the chain are delayed (`HALTSIGNING{CHAIN}`) */
  outboundDelayed: boolean
}

export type PoolStatusParams = {
  asset: AnyAsset
  /** THORChain or MAYAChain */
  protocol: Chain
  mimir: Record<string, number>
  /** Current height of the protocol, used for mimir values set as block height */
  lastHeight: number
  /** Chains marked as `halted` by `inbound_addresses` */
  haltedChains: Chain[]
  /** Chains marked as `chain_lp_actions_paused` by `inbound_addresses` */
  pausedLpChains: Chain[]
}

/**
 * Mimir key of the LP deposit pause of a single pool.
 * THORNode: `PauseLPDeposit-<asset.MimirString()>` = `PAUSELPDEPOSIT-<CHAIN>-<SYMBOL>` (upper case)
 */
export const getPoolDepositPauseKey = ({ chain, symbol }: Pick<AnyAsset, 'chain' | 'symbol'>): string =>
  `PAUSELPDEPOSIT-${chain}-${symbol}`.toUpperCase()

/**
 * Status of a pool, `undefined` if all pool actions are available.
 */
export const getPoolStatus = ({
  asset,
  protocol,
  mimir,
  lastHeight,
  haltedChains,
  pausedLpChains
}: PoolStatusParams): PoolStatus | undefined => {
  const isThor = protocol === THORChain
  const getMimirStatus = isThor ? getMimirStatusThor : getMimirStatusMaya
  const isActive = (key: string) => getMimirStatus(mimir[key], lastHeight)
  const chain = asset.chain.toUpperCase()

  const kind = ((): PoolStatusKind | undefined => {
    if (isActive(`HALT${chain}CHAIN`) || isActive(isThor ? 'HALTTHORCHAIN' : 'HALTMAYACHAIN')) return 'chain'
    // `inbound_addresses` marks a chain as `halted` for a trading halt, too
    if (isActive(`HALT${chain}TRADING`) || isActive('HALTTRADING')) return 'trading'
    if (haltedChains.includes(asset.chain)) return 'chain'
    if (isActive(`PAUSELP${chain}`) || isActive('PAUSELP') || pausedLpChains.includes(asset.chain)) return 'lp'
    // THORNode `IsPoolDepositPaused` is `value > 0`, no height check (keeper_halt.go)
    if ((mimir[getPoolDepositPauseKey(asset)] ?? 0) > 0) return 'deposit'
    return undefined
  })()

  return kind ? { kind, outboundDelayed: isActive(`HALTSIGNING${chain}`) } : undefined
}

/** Swap is unavailable for halted chains or halted trading */
export const isSwapDisabled = (status?: PoolStatus): boolean => status?.kind === 'chain' || status?.kind === 'trading'

/** Add (deposit) is unavailable for any limited pool */
export const isAddDisabled = (status?: PoolStatus): boolean => status !== undefined
