import { BaseAmount } from '@xchainjs/xchain-util'

import type { ChurnConstants } from '../../../../hooks/useChurnConstants'
import { NodeInfo } from '../../../../services/thorchain/types'
import { NodeNetworkContext, WATCH_RANK, activeNodes, flag, isActive, isLeaving, zeroRune } from './common'
import { compareVersions } from './version'

export const lastChurnHeight = (nodes: NodeInfo[]): number =>
  activeNodes(nodes).reduce((acc, { activeBlockHeight }) => Math.max(acc, activeBlockHeight || 0), 0)

export type BadActorRedline = {
  redline: number
  scores: Map<string, number>
  belowRedline: string[]
  worst: string | null
  badActors: string[]
  lastChurnHeight: number
  blocksSinceChurn: number
  slashThreshold: number | null
}

export const badActorRedline = (
  nodes: NodeInfo[],
  constants: ChurnConstants,
  currentHeight: number
): BadActorRedline => {
  const active = activeNodes(nodes)
  const churnHeight = lastChurnHeight(nodes)
  const blocksSinceChurn = Math.max(currentHeight - churnHeight, 0)
  const empty: BadActorRedline = {
    redline: 0,
    scores: new Map(),
    belowRedline: [],
    worst: null,
    badActors: [],
    lastChurnHeight: churnHeight,
    blocksSinceChurn,
    slashThreshold: null
  }
  if (constants.badValidatorRedline <= 0 || active.length === 0 || blocksSinceChurn <= 0) return empty

  const tracker = active
    .filter(({ slashPoints }) => slashPoints > constants.minSlashPointsForBadValidator)
    .map(({ address, slashPoints }) => ({
      address,
      score: slashPoints > 0 ? blocksSinceChurn / slashPoints : blocksSinceChurn
    }))
  if (tracker.length === 0) return empty

  const sorted = [...tracker].sort((a, b) => a.score - b.score)
  const total = sorted.reduce((acc, { score }) => acc + score, 0)
  const redline = total / active.length / constants.badValidatorRedline
  const belowRedline = sorted.filter(({ score }) => redline >= score).map(({ address }) => address)
  const worst = sorted[0].address

  return {
    redline,
    scores: new Map(sorted.map(({ address, score }) => [address, score])),
    belowRedline,
    worst,
    badActors: belowRedline.length > 0 ? belowRedline : [worst],
    lastChurnHeight: churnHeight,
    blocksSinceChurn,
    slashThreshold: redline > 0 ? Math.ceil(blocksSinceChurn / redline) : null
  }
}

export type BondRank = { rank: number; activeCount: number; lowestBond: BaseAmount; isLowest: boolean }

export const bondRank = (node: NodeInfo, nodes: NodeInfo[]): BondRank => {
  const others = activeNodes(nodes).filter(({ address }) => address !== node.address)
  const activeCount = others.length + flag(isActive(node))
  const lowestBond = [...others, ...(isActive(node) ? [node] : [])].reduce<BaseAmount | null>(
    (acc, { bond }) => (acc === null || bond.lt(acc) ? bond : acc),
    null
  )
  const rank = 1 + others.filter(({ bond }) => bond.lt(node.bond)).length
  return { rank, activeCount, lowestBond: lowestBond ?? zeroRune(), isLowest: activeCount > 0 && rank === 1 }
}

export type AgeRank = { rank: number; activeCount: number }

export const ageRank = (node: NodeInfo, nodes: NodeInfo[]): AgeRank => {
  const others = activeNodes(nodes).filter(({ address }) => address !== node.address)
  return {
    rank: 1 + others.filter(({ activeBlockHeight }) => activeBlockHeight < node.activeBlockHeight).length,
    activeCount: others.length + flag(isActive(node))
  }
}

export const isMissingBlocksRuleEnabled = ({
  missingBlockChurnOut,
  maxMissingBlockChurnOut
}: ChurnConstants): boolean => missingBlockChurnOut > 0 && maxMissingBlockChurnOut > 0

const maxAbleToLeave = (count: number): number => {
  const majority = Math.floor((count * 2) / 3) + 1
  const max = count - majority
  return count - max < 4 ? Math.max(count - 4, 0) : max
}

export type ChurnOutCause = 'leave' | 'slash' | 'bond' | 'version' | 'age' | 'missingBlocks'

export type ProjectedChurnOuts = {
  causes: Map<string, ChurnOutCause[]>
  expectedCount: number
  setFull: boolean
}

export const projectedChurnOuts = ({
  nodes,
  constants,
  version,
  currentHeight
}: NodeNetworkContext): ProjectedChurnOuts => {
  const active = activeNodes(nodes)
  const setFull = active.length >= constants.desiredValidatorSet
  const causes = new Map<string, ChurnOutCause[]>()
  const mark = (address: string, cause: ChurnOutCause) => causes.set(address, [...(causes.get(address) ?? []), cause])
  const unmarked = () => active.filter(({ address }) => !causes.has(address))

  active.filter(isLeaving).forEach(({ address }) => mark(address, 'leave'))

  badActorRedline(nodes, constants, currentHeight).badActors.forEach((address) => mark(address, 'slash'))

  if (setFull) {
    const lowest = unmarked().reduce<NodeInfo | null>((acc, n) => (acc === null || n.bond.lt(acc.bond) ? n : acc), null)
    if (lowest) mark(lowest.address, 'bond')
  }

  if (version && version.next !== '') {
    const eligibleFrom = (version.nextSinceHeight || 0) + constants.churnOutForLowVersionBlocks
    if (currentHeight > 0 && currentHeight >= eligibleFrom) {
      unmarked()
        .filter((n) => compareVersions(n.version, version.next) < 0)
        .slice(0, Math.max(constants.maxNodeToChurnOutForLowVersion, 0))
        .forEach(({ address }) => mark(address, 'version'))
    }
  }

  const oldest = unmarked().reduce<NodeInfo | null>(
    (acc, n) => (acc === null || n.activeBlockHeight < acc.activeBlockHeight ? n : acc),
    null
  )
  if (oldest) mark(oldest.address, 'age')

  if (isMissingBlocksRuleEnabled(constants)) {
    unmarked()
      .sort((a, b) => b.missingBlocks - a.missingBlocks)
      .filter((n) => n.missingBlocks > constants.missingBlockChurnOut)
      .slice(0, constants.maxMissingBlockChurnOut)
      .forEach(({ address }) => mark(address, 'missingBlocks'))
  }

  const maxRemove = maxAbleToLeave(active.length)
  const hasLeaving = active.some(isLeaving)
  const expectedCount = maxRemove === 0 ? flag(hasLeaving) : Math.min(causes.size, maxRemove)

  return { causes, expectedCount, setFull }
}

export const slashRank = (node: NodeInfo, nodes: NodeInfo[]): number =>
  1 +
  activeNodes(nodes).filter(({ address, slashPoints }) => address !== node.address && slashPoints > node.slashPoints)
    .length

export const slashWatch = (node: NodeInfo, nodes: NodeInfo[], constants: ChurnConstants): boolean =>
  node.slashPoints > constants.minSlashPointsForBadValidator && slashRank(node, nodes) <= WATCH_RANK
