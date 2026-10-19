import type { ChurnConstants } from '../../../../hooks/useChurnConstants'
import { NodeInfo, ThorchainVersion } from '../../../../services/thorchain/types'
import { activeNodes, flag } from './common'

export const VERSION_BEHIND_ADOPTION = 1 / 3

const parseVersion = (version: string): number[] =>
  version
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => {
      const value = parseInt(part, 10)
      return Number.isFinite(value) ? value : 0
    })

export const compareVersions = (a: string, b: string): number => {
  const x = parseVersion(a)
  const y = parseVersion(b)
  const length = Math.max(x.length, y.length)
  for (let i = 0; i < length; i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

export type VersionCount = { version: string; count: number }

export const versionDistribution = (nodes: NodeInfo[]): VersionCount[] => {
  const counts = new Map<string, number>()
  for (const { version } of activeNodes(nodes)) {
    if (!version) continue
    counts.set(version, (counts.get(version) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => compareVersions(b.version, a.version) || b.count - a.count)
}

export type VersionLevel = 'below' | 'behind' | 'current'

export type VersionState = {
  level: VersionLevel
  nodeVersion: string
  requiredVersion: string
  highestVersion: string
  highestCount: number
  activeCount: number
  churnOutEligibleFromHeight: number | null
  churnOutEligibleNow: boolean
}

export const versionState = (
  node: NodeInfo,
  version: ThorchainVersion,
  nodes: NodeInfo[],
  constants: ChurnConstants,
  currentHeight: number
): VersionState => {
  const distribution = versionDistribution(nodes)
  const activeCount = activeNodes(nodes).length
  const highest = distribution
    .reduce<VersionCount[]>(
      (acc, { version, count }) => [...acc, { version, count: (acc[acc.length - 1]?.count ?? 0) + count }],
      []
    )
    .find(({ count }) => count >= activeCount * VERSION_BEHIND_ADOPTION)
  const requiredVersion = version.next
  const below = requiredVersion !== '' && compareVersions(node.version, requiredVersion) < 0
  const behind = !below && !!highest && compareVersions(node.version, highest.version) < 0
  const churnOutEligibleFromHeight = below
    ? (version.nextSinceHeight || 0) + constants.churnOutForLowVersionBlocks
    : null
  return {
    level: below ? 'below' : behind ? 'behind' : 'current',
    nodeVersion: node.version,
    requiredVersion,
    highestVersion: highest?.version ?? node.version,
    highestCount: highest?.count ?? 0,
    activeCount,
    churnOutEligibleFromHeight,
    churnOutEligibleNow:
      churnOutEligibleFromHeight !== null && currentHeight > 0 && currentHeight >= churnOutEligibleFromHeight
  }
}

export const versionData = (state: VersionState): Record<string, string | number> => ({
  level: state.level,
  nodeVersion: state.nodeVersion,
  requiredVersion: state.requiredVersion,
  highestVersion: state.highestVersion,
  highestCount: state.highestCount,
  activeCount: state.activeCount,
  churnOutEligibleNow: flag(state.churnOutEligibleNow),
  ...(state.churnOutEligibleFromHeight !== null ? { churnOutEligibleFromHeight: state.churnOutEligibleFromHeight } : {})
})
