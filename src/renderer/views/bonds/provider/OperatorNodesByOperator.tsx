import { useCallback } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { Address } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ChurnOutlookTag } from '../../../components/Bonds/provider/ChurnOutlookCard'
import { NodeHealthTag } from '../../../components/Bonds/provider/NodeHealthTag'
import { NodeNetworkContext } from '../../../components/Bonds/provider/nodeNetwork'
import {
  OPERATOR_GROUPS_CELL,
  OPERATOR_GROUPS_COLUMN,
  OperatorGroup,
  OperatorGroupRowData,
  OperatorGroupsTable
} from '../../../components/Bonds/provider/OperatorGroupsTable'
import { VersionChip } from '../../../components/Bonds/provider/VersionChip'
import { useNextChurn } from '../../../hooks/useNextChurn'

type Props = {
  groups: OperatorGroup[]
  network: Network
  isPrivate: boolean
  networkCtx: O.Option<NodeNetworkContext>
  onOpenDetail: (nodeAddress: Address, signer?: Address) => void
}

export const OperatorNodesByOperator = ({ groups, network, isPrivate, networkCtx, onOpenDetail }: Props) => {
  const intl = useIntl()
  const nextChurn = useNextChurn()
  const churnHalted = FP.pipe(
    nextChurn,
    O.exists(({ halted }) => halted)
  )
  const onOpen = useCallback(
    ({ node, signer }: OperatorGroupRowData) => onOpenDetail(node.address, O.toUndefined(signer)),
    [onOpenDetail]
  )

  const extraHeaderCells = (
    <>
      <th className={clsx(OPERATOR_GROUPS_COLUMN, 'text-left')}>{intl.formatMessage({ id: 'bonds.health.title' })}</th>
      <th className={clsx(OPERATOR_GROUPS_COLUMN, 'text-left')}>{intl.formatMessage({ id: 'bonds.outlook.title' })}</th>
    </>
  )

  const renderExtraCells = ({ node }: OperatorGroupRowData) => (
    <>
      <td className={OPERATOR_GROUPS_CELL}>
        <div className="flex items-center gap-2">
          <NodeHealthTag node={node} ctx={networkCtx} />
          <VersionChip node={node} ctx={networkCtx} />
        </div>
      </td>
      <td className={OPERATOR_GROUPS_CELL}>
        <ChurnOutlookTag node={node} ctx={networkCtx} isPrivate={isPrivate} churnHalted={churnHalted} />
      </td>
    </>
  )

  return (
    <>
      <OperatorGroupsTable
        groups={groups}
        network={network}
        isPrivate={isPrivate}
        onOpen={onOpen}
        extraHeaderCells={extraHeaderCells}
        renderExtraCells={renderExtraCells}
      />
    </>
  )
}
