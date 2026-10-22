import { IntlShape } from 'react-intl'

import { NodeInfo, NodeStatusEnum } from '../../../services/thorchain/types'
import type { HealthLevel, HealthReason, VersionState } from './nodeNetwork'

export const bareVersion = (version: string | number | undefined): string =>
  String(version ?? '')
    .trim()
    .replace(/^v/i, '')

const formatCount = (intl: IntlShape, value: string | number | undefined): string => {
  const parsed = Number(value ?? 0)
  return intl.formatNumber(Number.isFinite(parsed) ? parsed : 0)
}

export const healthLevelMessage = (level: HealthLevel, intl: IntlShape): string => {
  switch (level) {
    case 'healthy':
      return intl.formatMessage({ id: 'bonds.health.healthy' })
    case 'attention':
      return intl.formatMessage({ id: 'bonds.health.attention' })
    case 'risk':
      return intl.formatMessage({ id: 'bonds.health.risk' })
  }
}

const versionReasonMessage = ({ data }: HealthReason, intl: IntlShape, node?: Pick<NodeInfo, 'status'>): string => {
  const version = bareVersion(data.nodeVersion)
  const required = bareVersion(data.requiredVersion)
  if (!version) {
    const standby = !!node && node.status !== NodeStatusEnum.Active
    return intl.formatMessage({ id: standby ? 'bonds.version.belowStandby' : 'bonds.version.belowNow' }, { required })
  }
  if (!node) return intl.formatMessage({ id: 'bonds.health.reason.versionBelow' }, { version, required })
  if (node.status !== NodeStatusEnum.Active) {
    return intl.formatMessage({ id: 'bonds.health.reason.versionBelowStandby' }, { version, required })
  }
  if (data.churnOutEligibleNow === 1 || data.churnOutEligibleFromHeight === undefined) {
    return intl.formatMessage({ id: 'bonds.health.reason.versionBelowNow' }, { version, required })
  }
  return intl.formatMessage(
    { id: 'bonds.health.reason.versionBelowActive' },
    { version, required, height: formatCount(intl, data.churnOutEligibleFromHeight) }
  )
}

export const healthReasonMessage = (reason: HealthReason, intl: IntlShape, node?: Pick<NodeInfo, 'status'>): string => {
  const { kind, severity, data } = reason
  switch (kind) {
    case 'version':
      return versionReasonMessage(reason, intl, node)
    case 'slash': {
      const points = formatCount(intl, data.slashPoints)
      if (severity === 'risk') {
        return data.belowRedline === 1 && data.threshold !== undefined
          ? intl.formatMessage(
              { id: 'bonds.health.reason.slashRedline' },
              { points, threshold: formatCount(intl, data.threshold) }
            )
          : intl.formatMessage({ id: 'bonds.health.reason.slashWorst' }, { points })
      }
      const activeCount = Number(data.activeCount) || 0
      const slashRank = Number(data.slashRank) || 0
      return intl.formatMessage(
        { id: 'bonds.health.reason.slashWarn' },
        {
          points,
          position: intl.formatMessage(
            { id: 'bonds.outlook.ordinal' },
            { rank: activeCount > 0 && slashRank > 0 ? activeCount - slashRank + 1 : 0 }
          ),
          activeCount: formatCount(intl, data.activeCount)
        }
      )
    }
    case 'missingBlocks': {
      const count = formatCount(intl, data.missingBlocks)
      return severity === 'risk' && Number(data.limit) > 0
        ? intl.formatMessage(
            { id: 'bonds.health.reason.missingBlocksRisk' },
            { count, limit: formatCount(intl, data.limit) }
          )
        : intl.formatMessage({ id: 'bonds.health.reason.missingBlocks' }, { count })
    }
    case 'chainLag':
      return intl.formatMessage(
        { id: 'bonds.health.reason.chainLag' },
        { chain: String(data.chain ?? ''), lag: formatCount(intl, data.lag) }
      )
    case 'leaving':
      return intl.formatMessage({
        id: data.forcedToLeave === 1 ? 'bonds.health.reason.forcedLeave' : 'bonds.health.reason.leaving'
      })
    case 'maintenance':
      return intl.formatMessage({ id: 'bonds.health.reason.maintenance' })
  }
}

export const versionTooltipMessage = (state: VersionState, node: Pick<NodeInfo, 'status'>, intl: IntlShape): string => {
  const required = bareVersion(state.requiredVersion)
  switch (state.level) {
    case 'below':
      if (node.status !== NodeStatusEnum.Active) {
        return intl.formatMessage({ id: 'bonds.version.belowStandby' }, { required })
      }
      return state.churnOutEligibleNow || state.churnOutEligibleFromHeight === null
        ? intl.formatMessage({ id: 'bonds.version.belowNow' }, { required })
        : intl.formatMessage(
            { id: 'bonds.version.below' },
            { required, height: formatCount(intl, state.churnOutEligibleFromHeight) }
          )
    case 'behind':
      return intl.formatMessage(
        { id: 'bonds.version.behind' },
        {
          highest: bareVersion(state.highestVersion),
          count: formatCount(intl, state.highestCount),
          total: formatCount(intl, state.activeCount)
        }
      )
    case 'current':
      return intl.formatMessage({ id: 'bonds.version.current' }, { version: bareVersion(state.nodeVersion) })
  }
}
