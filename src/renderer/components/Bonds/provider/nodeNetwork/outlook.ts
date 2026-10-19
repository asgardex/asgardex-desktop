import { NodeInfo, NodeStatusEnum } from '../../../../services/thorchain/types'
import {
  ageRank,
  badActorRedline,
  bondRank,
  isMissingBlocksRuleEnabled,
  projectedChurnOuts,
  slashRank,
  slashWatch
} from './churnCascade'
import {
  NodeNetworkContext,
  WATCH_RANK,
  activeNodes,
  flag,
  isActive,
  isCandidate,
  isLeaving,
  isPreflightReady,
  networkMedians
} from './common'
import { versionData, versionState } from './version'

export type OutlookVerdict = 'likelyIn' | 'likelyStays' | 'watch' | 'likelyOut' | 'leaving' | 'blocked' | 'unknown'

export type OutlookReason = {
  kind: 'bond' | 'age' | 'slash' | 'version' | 'preflight' | 'leave' | 'maintenance' | 'slots' | 'missingBlocks'
  severity: 'info' | 'warn' | 'risk'
  data: Record<string, string | number>
}

export type ChurnOutlook = { verdict: OutlookVerdict; reasons: OutlookReason[] }

const SEVERITY_ORDER: Record<OutlookReason['severity'], number> = { risk: 0, warn: 1, info: 2 }

export const bySeverity = <T extends { severity: OutlookReason['severity'] }>(reasons: T[]): T[] =>
  [...reasons].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

export const leaveData = (node: NodeInfo): Record<string, string | number> => ({
  requestedToLeave: flag(node.requestedToLeave),
  forcedToLeave: flag(node.forcedToLeave),
  leaveHeight: node.leaveHeight
})

const preflightData = (node: NodeInfo): Record<string, string | number> => ({
  status: node.preflightStatus.status,
  reason: node.preflightStatus.reason,
  code: node.preflightStatus.code
})

const activeOutlook = (node: NodeInfo, ctx: NodeNetworkContext): ChurnOutlook => {
  if (isLeaving(node))
    return { verdict: 'leaving', reasons: [{ kind: 'leave', severity: 'risk', data: leaveData(node) }] }

  const { nodes, constants, version, currentHeight } = ctx
  const projected = projectedChurnOuts(ctx)
  const causes = projected.causes.get(node.address) ?? []
  const reasons: OutlookReason[] = []

  const bond = bondRank(node, nodes)
  reasons.push({
    kind: 'bond',
    severity:
      causes.includes('bond') || (bond.isLowest && projected.setFull)
        ? 'risk'
        : bond.rank <= WATCH_RANK
          ? 'warn'
          : 'info',
    data: {
      rank: bond.rank,
      activeCount: bond.activeCount,
      lowestBond: bond.lowestBond.amount().toFixed(0),
      desiredValidatorSet: constants.desiredValidatorSet,
      setFull: flag(projected.setFull)
    }
  })

  const age = ageRank(node, nodes)
  reasons.push({
    kind: 'age',
    severity: causes.includes('age') ? 'risk' : age.rank <= WATCH_RANK ? 'warn' : 'info',
    data: {
      rank: age.rank,
      activeCount: age.activeCount,
      activeBlockHeight: node.activeBlockHeight,
      blocksActive: Math.max(currentHeight - node.activeBlockHeight, 0)
    }
  })

  const bad = badActorRedline(nodes, constants, currentHeight)
  const medians = networkMedians(nodes)
  const isBelowRedline = bad.belowRedline.includes(node.address)
  const isWorst = bad.worst === node.address
  reasons.push({
    kind: 'slash',
    severity:
      causes.includes('slash') || isBelowRedline || isWorst
        ? 'risk'
        : slashWatch(node, nodes, constants)
          ? 'warn'
          : 'info',
    data: {
      slashPoints: node.slashPoints,
      networkMedian: medians.slashPoints,
      slashRank: slashRank(node, nodes),
      activeCount: activeNodes(nodes).length,
      minSlashPointsForBadValidator: constants.minSlashPointsForBadValidator,
      belowRedline: flag(isBelowRedline),
      worst: flag(isWorst),
      ...(bad.slashThreshold !== null ? { threshold: bad.slashThreshold } : {})
    }
  })

  if (causes.includes('missingBlocks') || (isMissingBlocksRuleEnabled(constants) && node.missingBlocks > 0)) {
    reasons.push({
      kind: 'missingBlocks',
      severity: causes.includes('missingBlocks') ? 'risk' : 'warn',
      data: {
        missingBlocks: node.missingBlocks,
        limit: constants.missingBlockChurnOut,
        maxChurnOut: constants.maxMissingBlockChurnOut
      }
    })
  }

  if (version) {
    const state = versionState(node, version, nodes, constants, currentHeight)
    reasons.push({
      kind: 'version',
      severity:
        state.level === 'below' ? (causes.includes('version') || state.churnOutEligibleNow ? 'risk' : 'warn') : 'info',
      data: versionData(state)
    })
  }

  const sorted = bySeverity(reasons)
  const verdict: OutlookVerdict = sorted.some(({ severity }) => severity === 'risk')
    ? 'likelyOut'
    : sorted.some(({ severity }) => severity === 'warn')
      ? 'watch'
      : 'likelyStays'
  return { verdict, reasons: sorted }
}

const candidateOutlook = (node: NodeInfo, ctx: NodeNetworkContext): ChurnOutlook => {
  const { nodes, constants, version, currentHeight } = ctx
  const blockers: OutlookReason[] = []

  if (node.preflightStatus.status !== '' && !isPreflightReady(node)) {
    blockers.push({ kind: 'preflight', severity: 'risk', data: preflightData(node) })
  }
  if (node.maintenance) blockers.push({ kind: 'maintenance', severity: 'risk', data: {} })
  if (version) {
    const state = versionState(node, version, nodes, constants, currentHeight)
    if (state.level === 'below') blockers.push({ kind: 'version', severity: 'risk', data: versionData(state) })
  }
  if (blockers.length > 0) return { verdict: 'blocked', reasons: blockers }

  const activeCount = activeNodes(nodes).length
  const { expectedCount } = projectedChurnOuts(ctx)
  const readyAhead = nodes.filter(
    (n) =>
      n.address !== node.address &&
      isCandidate(n) &&
      (n.status === NodeStatusEnum.Ready || isPreflightReady(n)) &&
      n.bond.gt(node.bond)
  ).length
  const freeSlots = Math.max(
    Math.min(constants.desiredValidatorSet - activeCount + expectedCount, expectedCount + constants.newNodesPerChurn),
    0
  )
  const outbid = readyAhead >= freeSlots
  return {
    verdict: outbid ? 'blocked' : 'likelyIn',
    reasons: [
      {
        kind: 'slots',
        severity: outbid ? 'warn' : 'info',
        data: {
          freeSlots,
          expectedChurnOuts: expectedCount,
          activeCount,
          desiredValidatorSet: constants.desiredValidatorSet,
          readyAhead
        }
      }
    ]
  }
}

export const churnOutlook = (node: NodeInfo, ctx: NodeNetworkContext): ChurnOutlook => {
  if (isActive(node)) return activeOutlook(node, ctx)
  if (isCandidate(node)) return candidateOutlook(node, ctx)
  return { verdict: 'unknown', reasons: [] }
}
