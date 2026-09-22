import { BaseAmount, baseToAsset, formatAssetAmount } from '@xchainjs/xchain-util'

import { NodeStatusEnum } from '../../../services/thorchain/types'

const RUNE_DECIMALS = 8

export const formatRuneAmount = (amount: BaseAmount, decimal?: number): string => {
  const assetAmount = baseToAsset(amount)
  const value = assetAmount.amount()
  const maxDecimals = (() => {
    if (decimal !== undefined) return Math.max(decimal, 0)
    if (value.abs().gte(1000)) return 0
    return !value.isZero() && value.abs().toFixed(4) === (0).toFixed(4) ? RUNE_DECIMALS : 4
  })()
  return formatAssetAmount({ amount: assetAmount, decimal: maxDecimals, trimZeros: true })
}

export const formatDuration = (ms: number): string => {
  const totalMinutes = Math.max(Math.floor(ms / 60000), 0)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export const formatCountdown = (ms: number): string => {
  const totalMinutes = Math.max(Math.round(ms / 60000), 0)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export const formatChurnDate = (date: Date, locale: string): string =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date)

export const formatApy = (apy: number): string => `${(apy * 100).toFixed(1)}%`

export const formatOperatorFee = (fee: BaseAmount, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(fee.amount().div(100).toNumber())

const THORCHAIN_EXPLORER_URL = 'https://thorchain.net'

export const nodeExplorerUrl = (nodeAddress: string): string => `${THORCHAIN_EXPLORER_URL}/node/${nodeAddress}`

export const addressExplorerUrl = (address: string): string => `${THORCHAIN_EXPLORER_URL}/address/${address}`

export const isUnbondLocked = (status: NodeStatusEnum, signMembership: string[]): boolean =>
  status === NodeStatusEnum.Active || (signMembership ?? []).length > 0
