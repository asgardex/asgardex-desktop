import { baseAmount } from '@xchainjs/xchain-util'
import { IntlShape } from 'react-intl'

import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { formatPreflightReason, formatRuneAmount } from './helpers'
import type { ChurnOutlook, OutlookReason, OutlookVerdict } from './nodeNetwork'

export type OutlookCopyOptions = {
  verdict?: OutlookVerdict
  isPrivate?: boolean
}

const num = (data: OutlookReason['data'], key: string): number | undefined => {
  const value = Number(data[key])
  return key in data && Number.isFinite(value) ? value : undefined
}

const str = (data: OutlookReason['data'], key: string): string =>
  typeof data[key] === 'string' ? (data[key] as string) : data[key] !== undefined ? String(data[key]) : ''

const formatInt = (value: number | undefined, intl: IntlShape): string =>
  intl.formatNumber(value ?? 0, { maximumFractionDigits: 0 })

const formatOrdinal = (rank: number | undefined, intl: IntlShape): string =>
  intl.formatMessage({ id: 'bonds.outlook.ordinal' }, { rank: rank ?? 0 })

const exitPosition = (data: OutlookReason['data'], rankKey: string): number => {
  const rank = num(data, rankKey) ?? 0
  const count = num(data, 'activeCount') ?? 0
  return rank > 0 && count > 0 ? count - rank + 1 : 0
}

const formatLowestBond = (data: OutlookReason['data'], isPrivate: boolean): string => {
  if (isPrivate) return hiddenString
  const raw = str(data, 'lowestBond')
  return raw === '' ? '0' : formatRuneAmount(baseAmount(raw, THORCHAIN_DECIMAL))
}

export const outlookVerdictMessage = (verdict: OutlookVerdict, intl: IntlShape): string =>
  intl.formatMessage({ id: `bonds.outlook.verdict.${verdict}` })

export const outlookFactLabel = (reason: OutlookReason, intl: IntlShape): string =>
  intl.formatMessage({ id: `bonds.outlook.fact.${reason.kind}` })

export const outlookReasonMessage = (
  reason: OutlookReason,
  intl: IntlShape,
  { verdict, isPrivate = false }: OutlookCopyOptions = {}
): string => {
  const { data } = reason
  switch (reason.kind) {
    case 'bond': {
      return intl.formatMessage(
        { id: 'bonds.outlook.reason.bond' },
        {
          position: formatOrdinal(exitPosition(data, 'rank'), intl),
          activeCount: formatInt(num(data, 'activeCount'), intl),
          lowestBond: formatLowestBond(data, isPrivate)
        }
      )
    }
    case 'age':
      return intl.formatMessage(
        { id: 'bonds.outlook.reason.age' },
        {
          position: formatOrdinal(exitPosition(data, 'rank'), intl),
          activeCount: formatInt(num(data, 'activeCount'), intl)
        }
      )
    case 'slash': {
      const threshold = num(data, 'threshold')
      const values = {
        position: formatOrdinal(exitPosition(data, 'slashRank'), intl),
        activeCount: formatInt(num(data, 'activeCount'), intl),
        slashPoints: formatInt(num(data, 'slashPoints'), intl),
        threshold: formatInt(threshold, intl)
      }
      return intl.formatMessage(
        { id: threshold !== undefined ? 'bonds.outlook.reason.slash' : 'bonds.outlook.reason.slashNoLine' },
        values
      )
    }
    case 'missingBlocks':
      return intl.formatMessage(
        { id: 'bonds.outlook.reason.missingBlocks' },
        {
          missingBlocks: formatInt(num(data, 'missingBlocks'), intl),
          limit: formatInt(num(data, 'limit'), intl),
          maxChurnOut: formatInt(num(data, 'maxChurnOut'), intl)
        }
      )
    case 'version': {
      const level = str(data, 'level')
      const required = str(data, 'requiredVersion')
      if (level === 'below') {
        const fromHeight = num(data, 'churnOutEligibleFromHeight')
        const id =
          verdict === 'blocked'
            ? 'bonds.outlook.reason.versionBelowStandby'
            : num(data, 'churnOutEligibleNow') === 1 || fromHeight === undefined
              ? 'bonds.outlook.reason.versionBelowNow'
              : 'bonds.outlook.reason.versionBelow'
        return intl.formatMessage({ id }, { required, height: formatInt(fromHeight, intl) })
      }
      if (level === 'behind') {
        return intl.formatMessage(
          { id: 'bonds.outlook.reason.versionBehind' },
          {
            highest: str(data, 'highestVersion'),
            count: formatInt(num(data, 'highestCount'), intl),
            total: formatInt(num(data, 'activeCount'), intl)
          }
        )
      }
      return intl.formatMessage({ id: 'bonds.outlook.reason.versionCurrent' }, { version: str(data, 'nodeVersion') })
    }
    case 'preflight':
      return formatPreflightReason(str(data, 'reason') || str(data, 'status'))
    case 'leave':
      return intl.formatMessage({
        id: num(data, 'forcedToLeave') === 1 ? 'bonds.outlook.reason.leaveForced' : 'bonds.outlook.reason.leave'
      })
    case 'maintenance':
      return intl.formatMessage({ id: 'bonds.outlook.reason.maintenance' })
    case 'slots': {
      const readyAhead = num(data, 'readyAhead') ?? 0
      return intl.formatMessage(
        { id: readyAhead > 0 ? 'bonds.outlook.reason.slotsReady' : 'bonds.outlook.reason.slots' },
        { freeSlots: formatInt(num(data, 'freeSlots'), intl), readyAhead: formatInt(readyAhead, intl) }
      )
    }
  }
}

export type OutlookFactValue = { value: string; sub?: string }

export const outlookFactValue = (
  reason: OutlookReason,
  intl: IntlShape,
  { verdict, isPrivate = false }: OutlookCopyOptions = {}
): OutlookFactValue => {
  const { data } = reason
  const count = formatInt(num(data, 'activeCount'), intl)
  const position = (value: number) =>
    intl.formatMessage(
      { id: 'bonds.outlook.value.position' },
      { position: formatOrdinal(value, intl), activeCount: count }
    )
  switch (reason.kind) {
    case 'bond':
      return {
        value: position(exitPosition(data, 'rank')),
        sub: intl.formatMessage(
          { id: 'bonds.outlook.value.bondSub' },
          { lowestBond: formatLowestBond(data, isPrivate) }
        )
      }
    case 'age':
      return {
        value: position(exitPosition(data, 'rank')),
        sub: intl.formatMessage({ id: 'bonds.outlook.value.ageSub' })
      }
    case 'slash':
      return {
        value: position(exitPosition(data, 'slashRank')),
        sub: intl.formatMessage(
          { id: 'bonds.outlook.value.slashSub' },
          { points: formatInt(num(data, 'slashPoints'), intl) }
        )
      }
    case 'missingBlocks':
      return {
        value: formatInt(num(data, 'missingBlocks'), intl),
        sub: intl.formatMessage(
          { id: 'bonds.outlook.value.missingBlocks' },
          { limit: formatInt(num(data, 'limit'), intl) }
        )
      }
    case 'version': {
      const level = str(data, 'level')
      const value = `v${str(data, 'nodeVersion')}`
      if (level === 'below') {
        const id =
          verdict === 'blocked'
            ? 'bonds.outlook.value.versionBelowStandby'
            : num(data, 'churnOutEligibleNow') === 1
              ? 'bonds.outlook.value.versionUpgradeNow'
              : 'bonds.outlook.value.versionBelow'
        return { value, sub: intl.formatMessage({ id }, { required: str(data, 'requiredVersion') }) }
      }
      if (level === 'behind') {
        return {
          value,
          sub: intl.formatMessage(
            { id: 'bonds.outlook.value.versionBehind' },
            {
              highest: str(data, 'highestVersion'),
              count: formatInt(num(data, 'highestCount'), intl),
              total: count
            }
          )
        }
      }
      return { value, sub: intl.formatMessage({ id: 'bonds.outlook.value.versionCurrent' }) }
    }
    case 'preflight':
      return { value: formatPreflightReason(str(data, 'reason') || str(data, 'status')) }
    case 'leave':
      return {
        value: intl.formatMessage({
          id:
            num(data, 'forcedToLeave') === 1 ? 'bonds.outlook.value.leaveForced' : 'bonds.outlook.value.leaveRequested'
        }),
        sub: intl.formatMessage({ id: 'bonds.outlook.value.leaveSub' })
      }
    case 'maintenance':
      return {
        value: intl.formatMessage({ id: 'bonds.outlook.value.maintenanceOn' }),
        sub: intl.formatMessage({ id: 'bonds.outlook.value.maintenanceSub' })
      }
    case 'slots': {
      const readyAhead = num(data, 'readyAhead') ?? 0
      return {
        value: `~${formatInt(num(data, 'freeSlots'), intl)}`,
        sub: intl.formatMessage(
          { id: readyAhead > 0 ? 'bonds.outlook.value.slotsReadyAhead' : 'bonds.outlook.value.slots' },
          { readyAhead: formatInt(readyAhead, intl) }
        )
      }
    }
  }
}

export const outlookWhyMessage = (
  { verdict, reasons }: ChurnOutlook,
  intl: IntlShape,
  options: OutlookCopyOptions = {}
): string => {
  const top = reasons[0]
  if (verdict === 'unknown' || !top) return intl.formatMessage({ id: 'bonds.outlook.why.unknown' })
  if (verdict === 'likelyStays') return intl.formatMessage({ id: 'bonds.outlook.why.likelyStays' })

  const { data, severity } = top
  const position = formatOrdinal(exitPosition(data, 'rank'), intl)
  const activeCount = formatInt(num(data, 'activeCount'), intl)
  switch (top.kind) {
    case 'bond':
      return severity === 'risk'
        ? intl.formatMessage({ id: 'bonds.outlook.why.bondLowest' })
        : intl.formatMessage({ id: 'bonds.outlook.why.bondLow' }, { position, activeCount })
    case 'age':
      return severity === 'risk'
        ? intl.formatMessage({ id: 'bonds.outlook.why.ageOldest' })
        : intl.formatMessage({ id: 'bonds.outlook.why.ageOld' }, { position, activeCount })
    case 'slash':
      if (num(data, 'belowRedline') === 1) return intl.formatMessage({ id: 'bonds.outlook.why.slashRedline' })
      if (num(data, 'worst') === 1) return intl.formatMessage({ id: 'bonds.outlook.why.slashWorst' })
      return intl.formatMessage(
        { id: 'bonds.outlook.why.slashHigh' },
        { position: formatOrdinal(exitPosition(data, 'slashRank'), intl), activeCount }
      )
    case 'missingBlocks':
      return severity === 'risk'
        ? intl.formatMessage({ id: 'bonds.outlook.why.missingBlocks' })
        : outlookReasonMessage(top, intl, { ...options, verdict })
    default:
      return outlookReasonMessage(top, intl, { ...options, verdict })
  }
}
