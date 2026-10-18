import { ZERO_BASE_AMOUNT } from '../../../../const'
import { getLeaveMemo } from '../../../../helpers/memoHelper'
import { NodeStatusEnum } from '../../../../services/thorchain/types'
import { formatRuneAmount, operatorBond } from '../helpers'
import { SummaryRow } from './SummaryRow'
import { OperatorActionSpec, OperatorActionSummaryProps } from './types'

const LeaveSummary = ({ ctx: { intl, node, isActive, nextChurnLabel } }: OperatorActionSummaryProps) => {
  const otherProviders = node.bondProviders.providers.filter(
    ({ bondAddress }) => bondAddress.toLowerCase() !== node.nodeOperatorAddress.toLowerCase()
  ).length
  return isActive ? (
    <>
      <SummaryRow label={intl.formatMessage({ id: 'bonds.operator.leave.churnsOut' })} value={nextChurnLabel} />
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.leave.bondNow' })}
        value={intl.formatMessage({ id: 'bonds.operator.leave.bondNowValue' })}
      />
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.leave.afterChurn' })}
        value={intl.formatMessage({ id: 'bonds.operator.leave.afterChurnValue' })}
      />
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.leave.providersAffected' })}
        value={intl.formatMessage(
          { id: 'bonds.operator.leave.providersAffectedValue' },
          { count: node.bondProviders.providers.length }
        )}
      />
    </>
  ) : (
    <>
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.leave.bondToReturn' })}
        value={`${formatRuneAmount(operatorBond(node))} RUNE`}
      />
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.leave.nodeAfter' })}
        value={intl.formatMessage({ id: 'bonds.operator.leave.nodeAfterValue' })}
      />
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.leave.otherProviders' })}
        value={intl.formatMessage({ id: 'bonds.operator.leave.otherProvidersValue' }, { count: otherProviders })}
      />
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.leave.justChurned' })}
        value={intl.formatMessage({ id: 'bonds.operator.leave.justChurnedValue' })}
      />
    </>
  )
}

export const leaveSpec: OperatorActionSpec = {
  amount: ZERO_BASE_AMOUNT,
  danger: true,
  title: ({ intl, isActive }) =>
    intl.formatMessage({ id: isActive ? 'bonds.operator.leave.modalTitle' : 'bonds.operator.leave.retireModalTitle' }),
  subtitle: ({ nodeLabel }) => nodeLabel,
  cta: ({ intl, isActive }) =>
    intl.formatMessage({ id: isActive ? 'bonds.operator.leave.sign' : 'bonds.operator.leave.retireSign' }),
  memo: ({ node }) => getLeaveMemo(node.address),
  validate: () => ({ error: null, complete: true }),
  settled: (_ctx, _input, fresh) => fresh.requestedToLeave || fresh.status === NodeStatusEnum.Disabled,
  Summary: LeaveSummary
}
