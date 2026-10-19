import { NodeInfo } from '../../../../services/thorchain/types'
import { chainHeights, chainLag, chainLagThreshold } from './chains'
import { badActorRedline, projectedChurnOuts, slashRank, slashWatch } from './churnCascade'
import { NodeNetworkContext, activeNodes, flag, isActive, isLeaving, networkMedians } from './common'
import { bySeverity, leaveData } from './outlook'
import { versionData, versionState } from './version'

export const MISSING_BLOCKS_WARN = 0

export type HealthLevel = 'healthy' | 'attention' | 'risk'

export type HealthReason = {
  kind: 'version' | 'slash' | 'missingBlocks' | 'chainLag' | 'leaving' | 'maintenance'
  severity: 'warn' | 'risk'
  data: Record<string, string | number>
}

export type NodeHealth = { level: HealthLevel; reasons: HealthReason[] }

export const nodeHealth = (node: NodeInfo, ctx: NodeNetworkContext): NodeHealth => {
  const { nodes, constants, version, currentHeight } = ctx
  const reasons: HealthReason[] = []

  if (version) {
    const state = versionState(node, version, nodes, constants, currentHeight)
    if (state.level === 'below') reasons.push({ kind: 'version', severity: 'risk', data: versionData(state) })
  }

  if (isActive(node)) {
    const bad = badActorRedline(nodes, constants, currentHeight)
    const medians = networkMedians(nodes)
    const isBelowRedline = bad.belowRedline.includes(node.address)
    const isWorst = bad.worst === node.address
    if (isBelowRedline || isWorst || slashWatch(node, nodes, constants)) {
      reasons.push({
        kind: 'slash',
        severity: isBelowRedline || isWorst ? 'risk' : 'warn',
        data: {
          slashPoints: node.slashPoints,
          networkMedian: medians.slashPoints,
          slashRank: slashRank(node, nodes),
          activeCount: activeNodes(nodes).length,
          belowRedline: flag(isBelowRedline),
          worst: flag(isWorst),
          ...(bad.slashThreshold !== null ? { threshold: bad.slashThreshold } : {})
        }
      })
    }
  }

  if (node.missingBlocks > MISSING_BLOCKS_WARN) {
    const marked = isActive(node) && (projectedChurnOuts(ctx).causes.get(node.address) ?? []).includes('missingBlocks')
    reasons.push({
      kind: 'missingBlocks',
      severity: marked ? 'risk' : 'warn',
      data: {
        missingBlocks: node.missingBlocks,
        limit: constants.missingBlockChurnOut,
        maxChurnOut: constants.maxMissingBlockChurnOut
      }
    })
  }

  const heights = chainHeights(nodes)
  chainLag(node, heights)
    .filter(({ chain, lag }) => lag > chainLagThreshold(chain))
    .forEach(({ chain, height, networkHeight, lag }) =>
      reasons.push({
        kind: 'chainLag',
        severity: 'warn',
        data: { chain, height, networkHeight, lag, threshold: chainLagThreshold(chain) }
      })
    )

  if (isLeaving(node)) reasons.push({ kind: 'leaving', severity: 'warn', data: leaveData(node) })
  if (node.maintenance) reasons.push({ kind: 'maintenance', severity: 'warn', data: {} })

  const sorted = bySeverity(reasons)
  const level: HealthLevel = sorted.some(({ severity }) => severity === 'risk')
    ? 'risk'
    : sorted.length > 0
      ? 'attention'
      : 'healthy'
  return { level, reasons: sorted }
}
