import { BaseAmount, baseToAsset } from '@xchainjs/xchain-util'

import { NodeStatusEnum } from '../../../services/thorchain/types'

const RUNE_DECIMALS = 8

/**
 * Formats a RUNE `BaseAmount` like the designs do: "1,013,547".
 *
 * Decimals adapt to the magnitude unless `decimal` is given: amounts >= 1000
 * render as integers (the designs' look for bonds), smaller ones keep up to
 * four decimals so real payouts like 0.0032 RUNE don't collapse to "0". A
 * non-zero amount that would still round to 0 at four decimals falls back to
 * the full eight, so nothing that was paid ever shows as "0".
 */
export const formatRuneAmount = (amount: BaseAmount, decimal?: number): string => {
  const value = baseToAsset(amount).amount()
  const maxDecimals = (() => {
    if (decimal !== undefined) return Math.max(decimal, 0)
    if (value.abs().gte(1000)) return 0
    const roundsToZero = !value.isZero() && value.abs().toFixed(4) === (0).toFixed(4)
    return roundsToZero ? RUNE_DECIMALS : 4
  })()
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxDecimals }).format(
    parseFloat(value.toFixed(maxDecimals))
  )
}

/**
 * Formats a duration in ms as "1d 14h", "5h 12m" or "12m"
 */
export const formatDuration = (ms: number): string => {
  const totalMinutes = Math.max(Math.floor(ms / 60000), 0)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/**
 * Countdown to the next churn, e.g. "1d 14h 21m" — unlike `formatDuration` it
 * keeps the minutes at every magnitude, so the timer is seen moving.
 */
export const formatCountdown = (ms: number): string => {
  const totalMinutes = Math.max(Math.round(ms / 60000), 0)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/**
 * Churn date for chart tooltips, e.g. "21 Jun 2026"
 */
export const formatChurnDate = (date: Date, locale: string): string =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date)

/**
 * Shortens an address like the designs do: "thor1h4kjq…hyfpwkfr"
 */
export const shortenAddress = (address: string, start = 8, end = 8): string =>
  address.length > start + end + 1 ? `${address.slice(0, start)}…${address.slice(-end)}` : address

/**
 * Node operator fee as a percentage value, e.g. "1.5" — THORNode reports it in
 * basis points, which is a unit for memos and APIs, not for the UI.
 */
export const formatOperatorFee = (fee: BaseAmount, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(fee.amount().div(100).toNumber())

const THORCHAIN_EXPLORER_URL = 'https://thorchain.net'

/** node page of the THORChain explorer */
export const nodeExplorerUrl = (nodeAddress: string): string => `${THORCHAIN_EXPLORER_URL}/node/${nodeAddress}`

/** address page of the THORChain explorer */
export const addressExplorerUrl = (address: string): string => `${THORCHAIN_EXPLORER_URL}/address/${address}`

/**
 * THORChain rejects an UNBOND while the node is active or still a member of a
 * vault: churned out of the active set but with funds not yet migrated, its
 * `signer_membership` is still non-empty.
 */
export const isUnbondLocked = (status: NodeStatusEnum, signMembership: string[]): boolean =>
  status === NodeStatusEnum.Active || (signMembership ?? []).length > 0
