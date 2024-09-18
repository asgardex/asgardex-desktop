import { Address, AnyAsset, BaseAmount } from '@xchainjs/xchain-util'

import { ASGARDEX_THORNAME } from '../../shared/const'

const DELIMITER = ':'

export enum Action {
  add,
  withdraw
}

// Helper to filter out invalid values
const filterMemoPart = (part: unknown) => part !== null && part !== undefined

const mkMemo = (values: Array<string | null | undefined | number>) => values.filter(filterMemoPart).join(DELIMITER)

// Helper to create asset string from asset used in memo's
const assetToMemoString = ({ chain, symbol }: AnyAsset) => `${chain}.${symbol}`

/**
 * Memo to switch
 *
 * @param address Address to send amounts to
 *
 * Memo is based on definitions in https://gitlab.com/thorchain/thornode/-/blob/develop/x/thorchain/memo/memo.go#L38-65
 */
export const getSwitchMemo = (address: string) => mkMemo(['SWITCH', address])

/**
 * Memo to bond
 *
 * @param thorAddress THOR address to send amounts to
 *
 * Memo is based on definition in https://gitlab.com/thorchain/thornode/-/blob/develop/x/thorchain/memo/memo.go#L55
 * @docs https://docs.thorchain.org/thornodes/joining#2-send-bond
 */
export const getBondMemo = (thorAddress: string, providerAddress?: string, nodeFee?: number) =>
  mkMemo(['BOND', thorAddress, providerAddress, nodeFee])

/**
 * Memo to unbond
 *
 * @param thorAddress THOR address unbond from
 * @param units Base Amount of units to unbond
 *
 * Memo is based on definition in https://gitlab.com/thorchain/thornode/-/blob/develop/x/thorchain/memo/memo.go#L55
 * @docs https://docs.thorchain.org/thornodes/leaving#unbonding
 */
export const getUnbondMemo = (thorAddress: string, units: BaseAmount, providerAddress?: string) =>
  mkMemo(['UNBOND', thorAddress, units.amount().toString(), providerAddress])

/**
 * Memo to withdraw
 *
 * @param asset Asset to withdraw from a pool
 * @param percent Percent (0-100%)
 *
 * @see https://docs.thorchain.org/developers/transaction-memos#transactions
 */
export const getWithdrawMemo = ({
  asset,
  percent,
  targetAsset,
  short = true
}: {
  asset: AnyAsset
  percent: number
  targetAsset?: AnyAsset
  short?: boolean
}) => {
  const target = targetAsset ? assetToMemoString(targetAsset) : null
  // Accept percent between 0 - 100 only
  percent = Math.min(Math.max(percent, 0), 100)
  // Calculate percent into basis points (0-10000, where 100%=10000)
  const points = percent * 100
  const memo = short ? '-' : 'WITHDRAW'
  return mkMemo([memo, assetToMemoString(asset), points.toString(), target])
}

/**
 * Get swap memo used for calculating fees
 * @param param0
 * @returns
 */
export const getSwapMemo = ({
  targetAsset,
  targetAddress,
  toleranceBps,
  streamingInterval,
  streamingQuantity,
  affiliateName,
  affiliateBps
}: {
  targetAsset: AnyAsset
  targetAddress: Address
  toleranceBps: number | undefined
  streamingInterval: number
  streamingQuantity: number
  affiliateName: string
  affiliateBps: number
}) => {
  const target = assetToMemoString(targetAsset)
  const streaming = `0/${streamingInterval}/${streamingQuantity}`
  const memo = '='
  return mkMemo([memo, target, targetAddress, toleranceBps, streaming, affiliateName, affiliateBps])
}

/**
 * Memo to leave
 *
 * @param thorAddress THOR address to leave from
 *
 * Memo is based on definition in https://gitlab.com/thorchain/thornode/-/blob/develop/x/thorchain/memo/memo.go#L55
 * @docs https://docs.thorchain.org/thornodes/leaving#leaving
 */
export const getLeaveMemo = (thorAddress: string) => mkMemo(['LEAVE', thorAddress])

/**
 * Memo to deposit
 *
 * @param asset Asset to deposit into a specified pool
 * @param address (optional) For cross-chain deposits, an address is needed to cross-reference addresses
 *
 * Memo is based on definition in https://gitlab.com/thorchain/thornode/-/blob/develop/x/thorchain/memo/memo.go#L35
 */
export const getDepositMemo = ({
  asset,
  address = '',
  short = true
}: {
  asset: AnyAsset
  address?: string
  short?: boolean
}) => mkMemo([`${short ? '+' : 'ADD'}`, assetToMemoString(asset), address || null])

export const getRunePoolMemo = ({ action, bps }: { action: Action; bps: number }) => {
  const poolAction = action === Action.add ? `+` : '-'

  const memoParts = [`POOL${poolAction}`]

  if (action === Action.withdraw) {
    memoParts.push(bps.toString(), ASGARDEX_THORNAME, '0')
  }

  return mkMemo(memoParts)
}

export type AssetCodes = {
  [key: string]: string
}

const assetCodes: AssetCodes = {
  'THOR.RUNE': 'r',
  'BTC.BTC': 'b',
  'ETH.ETH': 'e',
  'GAIA.ATOM': 'g',
  'DOGE.DOGE': 'd',
  'LTC.LTC': 'l',
  'BCH.BCH': 'c',
  'AVAX.AVAX': 'a',
  'BSC.BNB': 's'
}

export const shortenMemo = (input: string): string => {
  // Extract the asset identifier from the input string
  const assetPattern = /:([^:]+):/
  const match = assetPattern.exec(input)

  if (match && match[1] && assetCodes[match[1]]) {
    // Replace the full asset name with its corresponding short code
    return input.replace(match[1], assetCodes[match[1]])
  }

  // Return the input as is if no matching asset code is found
  return input
}
