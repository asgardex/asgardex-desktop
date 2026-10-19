import { BaseAmount, baseAmount } from '@xchainjs/xchain-util'

import { THORCHAIN_DECIMAL } from '../../../../helpers/assetHelper'
import type { ChurnConstants } from '../../../../hooks/useChurnConstants'
import { NodeInfo, NodeStatusEnum, ThorchainVersion } from '../../../../services/thorchain/types'

export const WATCH_RANK = 3

const PREFLIGHT_READY = 'ready'

export type NodeNetworkContext = {
  nodes: NodeInfo[]
  constants: ChurnConstants
  version: ThorchainVersion | undefined
  currentHeight: number
}

export const isFiniteNumber = (value: number): boolean => typeof value === 'number' && Number.isFinite(value)

export const flag = (value: boolean): number => (value ? 1 : 0)

export const zeroRune = (): BaseAmount => baseAmount(0, THORCHAIN_DECIMAL)

export const isActive = (node: NodeInfo): boolean => node.status === NodeStatusEnum.Active

export const isLeaving = (node: NodeInfo): boolean => node.requestedToLeave || node.forcedToLeave

export const isPreflightReady = (node: NodeInfo): boolean =>
  node.preflightStatus.status.toLowerCase() === PREFLIGHT_READY

export const isCandidate = (node: NodeInfo): boolean =>
  node.status === NodeStatusEnum.Standby ||
  node.status === NodeStatusEnum.Ready ||
  node.status === NodeStatusEnum.Whitelisted

export const activeNodes = (nodes: NodeInfo[]): NodeInfo[] => nodes.filter(isActive)

export const median = (values: number[]): number => {
  const sorted = values.filter(isFiniteNumber).sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export type NetworkMedians = { slashPoints: number; activeCount: number }

export const networkMedians = (nodes: NodeInfo[]): NetworkMedians => {
  const active = activeNodes(nodes)
  return {
    slashPoints: median(active.map(({ slashPoints }) => slashPoints)),
    activeCount: active.length
  }
}
