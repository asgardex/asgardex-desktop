import { ReactNode, useState } from 'react'

import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import { Network } from '@xchainjs/xchain-client'
import { Address, BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { THORChain } from '../../../../shared/utils/chainIds'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { truncateAddress } from '../../../helpers/addressHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { OperatorNodeInfo } from '../../../hooks/useOperatorNodes'
import { NodeInfo, NodeStatusEnum } from '../../../services/thorchain/types'
import { BondProviderPosition } from '../../../views/bonds/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { formatBpsAsPercent, formatRuneAmount, isNodeLeaving, operatorFeeBps } from './helpers'
import { NodeStatusTag } from './NodeStatusTag'

export type OperatorGroupRole = 'operator' | 'provider'

export type OperatorGroupRowData = {
  node: NodeInfo
  role: O.Option<OperatorGroupRole>
  myBond: BaseAmount
  signer: O.Option<Address>
  isMonitored: boolean
}

export type OperatorGroup = {
  operatorAddress: Address
  isYou: boolean
  rows: OperatorGroupRowData[]
  myBond: BaseAmount
  nodeBond: BaseAmount
  positionCount: number
}

type GroupNodesByOperatorParams = {
  nodes: NodeInfo[]
  operatorNodes: OperatorNodeInfo[]
  positions: BondProviderPosition[]
}

const byBondDesc = (a: BaseAmount, b: BaseAmount) => (b.gt(a) ? 1 : b.lt(a) ? -1 : 0)

export const groupNodesByOperator = ({
  nodes,
  operatorNodes,
  positions
}: GroupNodesByOperatorParams): OperatorGroup[] => {
  const bondByNode = new Map<Address, { myBond: BaseAmount; signer: Address }>()
  positions.forEach(({ nodeAddress, myBond, signer }) => {
    const existing = bondByNode.get(nodeAddress)
    bondByNode.set(nodeAddress, {
      myBond: existing ? existing.myBond.plus(myBond) : myBond,
      signer: existing?.signer ?? signer.address
    })
  })
  const bondOf = (nodeAddress: Address) => {
    const bond = bondByNode.get(nodeAddress)
    return { myBond: bond?.myBond ?? ZERO_BASE_AMOUNT, signer: O.fromNullable(bond?.signer) }
  }

  const ownNodes = operatorNodes.filter(({ isOperator }) => isOperator)
  const ownOperators = new Set(ownNodes.map(({ nodeOperatorAddress }) => nodeOperatorAddress.toLowerCase()))
  const monitored = new Set(
    operatorNodes.filter(({ isMonitored, isOperator }) => isMonitored && !isOperator).map(({ address }) => address)
  )
  const nodeByAddress = new Map(nodes.map((node) => [node.address, node]))
  const otherOperators = new Set(
    [...bondByNode.keys(), ...monitored]
      .map((address) => nodeByAddress.get(address)?.nodeOperatorAddress.toLowerCase())
      .filter((operator): operator is string => operator !== undefined && !ownOperators.has(operator))
  )

  const ownRows: OperatorGroupRowData[] = ownNodes.map((node) => ({
    node,
    role: O.some('operator'),
    ...bondOf(node.address),
    isMonitored: false
  }))
  const otherRows: OperatorGroupRowData[] = nodes
    .filter(({ nodeOperatorAddress }) => otherOperators.has(nodeOperatorAddress.toLowerCase()))
    .map((node) => {
      const bond = bondOf(node.address)
      return {
        node,
        role: O.isSome(bond.signer) ? O.some<OperatorGroupRole>('provider') : O.none,
        ...bond,
        isMonitored: monitored.has(node.address)
      }
    })
    .filter(({ node, role, isMonitored }) => node.status !== NodeStatusEnum.Disabled || O.isSome(role) || isMonitored)

  const groups = new Map<string, OperatorGroup>()
  ;[...ownRows, ...otherRows].forEach((row) => {
    const key = row.node.nodeOperatorAddress.toLowerCase()
    const group = groups.get(key) ?? {
      operatorAddress: row.node.nodeOperatorAddress,
      isYou: ownOperators.has(key),
      rows: [],
      myBond: ZERO_BASE_AMOUNT,
      nodeBond: ZERO_BASE_AMOUNT,
      positionCount: 0
    }
    group.rows.push(row)
    group.myBond = group.myBond.plus(row.myBond)
    group.nodeBond = group.nodeBond.plus(row.node.bond)
    if (O.isSome(row.signer)) group.positionCount++
    groups.set(key, group)
  })

  return [...groups.values()]
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort(
        (a, b) =>
          Number(O.isSome(b.role)) - Number(O.isSome(a.role)) ||
          byBondDesc(a.myBond, b.myBond) ||
          byBondDesc(a.node.bond, b.node.bond)
      )
    }))
    .sort((a, b) => Number(b.isYou) - Number(a.isYou) || byBondDesc(a.myBond, b.myBond))
}

export const OPERATOR_GROUPS_COLUMN =
  'px-3 pb-2 font-main-semi-bold text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d whitespace-nowrap'
export const OPERATOR_GROUPS_CELL = 'px-3 py-3 font-main text-[14px] whitespace-nowrap'

const RuneAmount = ({ amount, network }: { amount: string; network: Network }) => (
  <span className="inline-flex items-center gap-1 align-middle">
    <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
    <span>{amount}</span>
  </span>
)

type RowProps = {
  row: OperatorGroupRowData
  isPrivate: boolean
  network: Network
  onOpen: (row: OperatorGroupRowData) => void
  extraCells?: ReactNode
}

export const OperatorGroupRow = ({ row, isPrivate, network, onOpen, extraCells }: RowProps) => {
  const intl = useIntl()
  const { node, myBond, role } = row

  const hasPosition = O.isSome(row.signer)
  const bondText = isPrivate ? hiddenString : formatRuneAmount(myBond)

  const share = (() => {
    if (myBond.lte(0)) return hasPosition ? intl.formatMessage({ id: 'bonds.operator.detail.idleSlot' }) : '—'
    if (node.bond.lte(0)) return '0%'
    const percent = baseToAsset(myBond).amount().div(baseToAsset(node.bond).amount()).times(100)
    return percent.lt(0.1) ? '<0.1%' : `${percent.toFixed(1)}%`
  })()

  const open = () => onOpen(row)

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      }}
      className="group cursor-pointer border-t border-solid border-gray0 hover:bg-gray0/40 focus-visible:outline-none dark:border-gray0d dark:hover:bg-gray0d/40">
      <td
        className={clsx(
          OPERATOR_GROUPS_CELL,
          'truncate group-hover:text-turquoise',
          O.isSome(role) ? 'text-text0 dark:text-text0d' : 'text-gray2 dark:text-gray2d'
        )}>
        {truncateAddress(node.address, THORChain, network)}
      </td>
      <td className={OPERATOR_GROUPS_CELL}>
        <NodeStatusTag status={node.status} leaving={isNodeLeaving(node)} />
      </td>
      <td className={OPERATOR_GROUPS_CELL}>
        {FP.pipe(
          role,
          O.fold(
            () => <span className="text-gray2 dark:text-gray2d">—</span>,
            (role) => (
              <span
                className={clsx(
                  'rounded-sm px-1.5 py-[1px] font-main-semi-bold text-[10px] tracking-[1px] whitespace-nowrap uppercase',
                  role === 'operator'
                    ? 'bg-turquoise/10 text-turquoise'
                    : 'bg-gray0 text-gray2 dark:bg-gray0d dark:text-gray2d'
                )}>
                {intl.formatMessage({
                  id: role === 'operator' ? 'bonds.byOperator.role.operator' : 'bonds.byOperator.role.provider'
                })}
              </span>
            )
          )
        )}
      </td>
      <td className={clsx(OPERATOR_GROUPS_CELL, 'text-right font-main-semi-bold text-text0 dark:text-text0d')}>
        {hasPosition ? <RuneAmount amount={bondText} network={network} /> : '—'}
      </td>
      <td className={clsx(OPERATOR_GROUPS_CELL, 'text-right text-gray2 dark:text-gray2d')}>
        {isPrivate && myBond.gt(0) ? hiddenString : share}
      </td>
      <td className={clsx(OPERATOR_GROUPS_CELL, 'text-right text-text0 dark:text-text0d')}>
        {formatBpsAsPercent(operatorFeeBps(node.bondProviders.nodeOperatorFee), intl.locale)}
      </td>
      {extraCells}
    </tr>
  )
}

type Props = {
  groups: OperatorGroup[]
  network: Network
  isPrivate: boolean
  onOpen: (row: OperatorGroupRowData) => void
  extraHeaderCells?: ReactNode
  renderExtraCells?: (row: OperatorGroupRowData) => ReactNode
}

export const OperatorGroupsTable = ({
  groups,
  network,
  isPrivate,
  onOpen,
  extraHeaderCells,
  renderExtraCells
}: Props) => {
  const intl = useIntl()
  const [expanded, setExpanded] = useState<O.Option<Address>>(O.none)

  const isExpanded = (operatorAddress: Address) =>
    FP.pipe(
      expanded,
      O.exists((address) => address === operatorAddress)
    )

  const toggle = (operatorAddress: Address) =>
    setExpanded(isExpanded(operatorAddress) ? O.none : O.some(operatorAddress))

  return (
    <div className="flex w-full flex-col gap-4">
      {groups.map((group) => {
        const open = isExpanded(group.operatorAddress)
        const active = group.rows.filter(({ node }) => node.status === NodeStatusEnum.Active).length
        const Caret = open ? ChevronDownIcon : ChevronRightIcon
        return (
          <div
            key={group.operatorAddress}
            className="flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 dark:border-gray0d dark:bg-bg0d">
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggle(group.operatorAddress)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  toggle(group.operatorAddress)
                }
              }}
              className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 focus-visible:outline-none">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Caret className="h-4 w-4 shrink-0 text-gray2 dark:text-gray2d" />
                  <span className="font-main-semi-bold text-[11px] tracking-[1.5px] text-gray2 uppercase dark:text-gray2d">
                    {intl.formatMessage({ id: 'bonds.byOperator.operator' })}
                  </span>
                  <span
                    className={clsx(
                      'truncate font-main text-[15px]',
                      group.isYou ? 'font-main-semi-bold text-turquoise' : 'text-text0 dark:text-text0d'
                    )}>
                    {truncateAddress(group.operatorAddress, THORChain, network)}
                    {group.isYou && ` (${intl.formatMessage({ id: 'bonds.provider.detail.you' })})`}
                  </span>
                </div>
                <span className="pl-6 font-main text-[13px] text-gray2 dark:text-gray2d">
                  {intl.formatMessage(
                    { id: 'bonds.byOperator.groupSummary' },
                    {
                      nodes: group.rows.length,
                      active,
                      bond: (
                        <RuneAmount
                          amount={isPrivate ? hiddenString : formatRuneAmount(group.nodeBond)}
                          network={network}
                        />
                      )
                    }
                  )}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-main-semi-bold text-[11px] tracking-[1.5px] text-gray2 uppercase dark:text-gray2d">
                  {intl.formatMessage({ id: 'bonds.byOperator.yourBond' })}
                </span>
                <span className="font-main-semi-bold text-[15px] text-text0 tabular-nums dark:text-text0d">
                  <RuneAmount amount={isPrivate ? hiddenString : formatRuneAmount(group.myBond)} network={network} />
                </span>
                {(group.myBond.gt(0) || isPrivate) && (
                  <span className="font-main text-[12px] text-gray2 dark:text-gray2d">
                    {intl.formatMessage(
                      { id: group.isYou ? 'bonds.byOperator.mine.operator' : 'bonds.byOperator.mine.provider' },
                      { nodes: group.rows.length, count: group.positionCount }
                    )}
                  </span>
                )}
              </div>
            </div>
            {open && (
              <div className="overflow-x-auto px-4 pb-2">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={clsx(OPERATOR_GROUPS_COLUMN, 'w-full text-left')}>
                        {intl.formatMessage({ id: 'bonds.byOperator.column.node' })}
                      </th>
                      <th className={clsx(OPERATOR_GROUPS_COLUMN, 'text-left')}>
                        {intl.formatMessage({ id: 'bonds.byOperator.column.status' })}
                      </th>
                      <th className={clsx(OPERATOR_GROUPS_COLUMN, 'text-left')}>
                        {intl.formatMessage({ id: 'bonds.byOperator.column.role' })}
                      </th>
                      <th className={clsx(OPERATOR_GROUPS_COLUMN, 'text-right')}>
                        {intl.formatMessage({ id: 'bonds.byOperator.column.bond' })}
                      </th>
                      <th className={clsx(OPERATOR_GROUPS_COLUMN, 'text-right')}>
                        {intl.formatMessage({ id: 'bonds.byOperator.column.share' })}
                      </th>
                      <th className={clsx(OPERATOR_GROUPS_COLUMN, 'text-right')}>
                        {intl.formatMessage({ id: 'bonds.byOperator.column.fee' })}
                      </th>
                      {extraHeaderCells}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <OperatorGroupRow
                        key={row.node.address}
                        row={row}
                        network={network}
                        isPrivate={isPrivate}
                        onOpen={onOpen}
                        extraCells={renderExtraCells?.(row)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
