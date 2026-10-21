import { BaseAmount, assetAmount, assetToBase, baseAmount, baseToAsset, formatAssetAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'

import { OperatorFinderFeeVault } from '../../../services/runebond/types'
import { NodeInfo, NodeStatusEnum, Providers } from '../../../services/thorchain/types'

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

export const runeToBaseAmount = (value: BigNumber): BaseAmount => assetToBase(assetAmount(value, RUNE_DECIMALS))

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

export const MAX_FEE_BPS = 10000

export const OPERATOR_BOND_ACTION_AMOUNT: BaseAmount = assetToBase(assetAmount(0.01, RUNE_DECIMALS))

export const operatorFeeBps = (fee: BaseAmount): number => fee.amount().toNumber()

export const formatBpsAsPercent = (bps: number, locale: string): string =>
  `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bps / 100)}%`

export const isNodeLeaving = ({ requestedToLeave, forcedToLeave }: NodeInfo): boolean =>
  requestedToLeave || forcedToLeave

export const operatorBond = (node: NodeInfo): BaseAmount =>
  node.bondProviders.providers
    .filter(({ bondAddress }) => bondAddress.toLowerCase() === node.nodeOperatorAddress.toLowerCase())
    .reduce((acc, { bond }) => acc.plus(bond), baseAmount(0, RUNE_DECIMALS))

export const hasBondProvider = (node: NodeInfo, address: string): boolean =>
  node.bondProviders.providers.some(({ bondAddress }) => bondAddress.toLowerCase() === address.toLowerCase())

export const canRemoveProvider = (node: NodeInfo, { bondAddress, bond }: Providers): boolean => {
  if (bondAddress.toLowerCase() === node.nodeOperatorAddress.toLowerCase()) return false
  if (bond.lte(0)) return true
  return node.status !== NodeStatusEnum.Active && node.status !== NodeStatusEnum.Ready
}

export const isBondActionLocked = (node: NodeInfo): boolean => node.status === NodeStatusEnum.Ready

export const isLeaveLocked = (node: NodeInfo): boolean =>
  node.status === NodeStatusEnum.Ready || (node.status === NodeStatusEnum.Active && isNodeLeaving(node))

const THORCHAIN_EXPLORER_URL = 'https://thorchain.net'

export const nodeExplorerUrl = (nodeAddress: string): string => `${THORCHAIN_EXPLORER_URL}/node/${nodeAddress}`

export const addressExplorerUrl = (address: string): string => `${THORCHAIN_EXPLORER_URL}/address/${address}`

export const isUnbondLocked = (status: NodeStatusEnum, signMembership: string[]): boolean =>
  status === NodeStatusEnum.Active || (signMembership ?? []).length > 0

const PREFLIGHT_BOND_PATTERN = /minimum bond requirement: (\d+)\/(\d+)/

export const formatPreflightReason = (reason: string): string =>
  reason.replace(PREFLIGHT_BOND_PATTERN, (_, bond: string, minBond: string) => {
    const rune = (value: string) => `ᚱ${formatRuneAmount(baseAmount(value, RUNE_DECIMALS))}`
    return `minimum bond requirement: ${rune(bond)} / ${rune(minBond)}`
  })

export type KnownFinderFeeVault = OperatorFinderFeeVault & { known: true }

export const isKnownVault = (vault?: OperatorFinderFeeVault): vault is KnownFinderFeeVault =>
  vault !== undefined && vault.known === true

export const canTopUpVault = (vault?: OperatorFinderFeeVault): vault is KnownFinderFeeVault => isKnownVault(vault)

export const isVaultDepleted = (vault?: OperatorFinderFeeVault): vault is KnownFinderFeeVault =>
  isKnownVault(vault) && vault.depleted
