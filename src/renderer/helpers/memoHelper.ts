import { Asset, BaseAmount } from '@xchainjs/xchain-util'

const DELIMITER = ':'

// Helper to filter out invalid values
const filterMemoPart = (part: unknown) => part !== null && part !== undefined

const mkMemo = (values: Array<string | null>) => values.filter(filterMemoPart).join(DELIMITER)

// Helper to create asset string from asset used in memo's
const assetToMemoString = ({ chain, symbol }: Asset) => `${chain}.${symbol}`

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
export const getBondMemo = (thorAddress: string) => mkMemo(['BOND', thorAddress])

/**
 * Memo to unbond
 *
 * @param thorAddress THOR address unbond from
 * @param units Base Amount of units to unbond
 *
 * Memo is based on definition in https://gitlab.com/thorchain/thornode/-/blob/develop/x/thorchain/memo/memo.go#L55
 * @docs https://docs.thorchain.org/thornodes/leaving#unbonding
 */
export const getUnbondMemo = (thorAddress: string, units: BaseAmount) =>
  mkMemo(['UNBOND', thorAddress, units.amount().toString()])

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
  asset: Asset
  percent: number
  targetAsset?: Asset
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
  asset: Asset
  address?: string
  short?: boolean
}) => mkMemo([`${short ? '+' : 'ADD'}`, assetToMemoString(asset), address || null])
