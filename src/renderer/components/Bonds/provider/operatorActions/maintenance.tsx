import { ZERO_BASE_AMOUNT } from '../../../../const'
import { getMaintenanceMemo } from '../../../../helpers/memoHelper'
import { SummaryRow } from './SummaryRow'
import { OperatorActionSpec, OperatorActionSummaryProps } from './types'

const MaintenanceSummary = ({ ctx: { intl, node, isActive } }: OperatorActionSummaryProps) => (
  <>
    <SummaryRow
      label={intl.formatMessage({ id: 'bonds.operator.maintenance.modeAfter' })}
      value={intl.formatMessage({
        id: node.maintenance ? 'bonds.operator.maintenance.modeOffValue' : 'bonds.operator.maintenance.modeOnValue'
      })}
    />
    <SummaryRow
      label={intl.formatMessage({ id: 'bonds.operator.maintenance.effect' })}
      value={intl.formatMessage({
        id: node.maintenance
          ? 'bonds.operator.maintenance.effectOffValue'
          : isActive
            ? 'bonds.operator.maintenance.effectOnActiveValue'
            : 'bonds.operator.maintenance.effectOnValue'
      })}
    />
  </>
)

export const maintenanceSpec: OperatorActionSpec = {
  amount: ZERO_BASE_AMOUNT,
  danger: false,
  title: ({ intl, node }) =>
    intl.formatMessage({
      id: node.maintenance ? 'bonds.operator.maintenance.disableTitle' : 'bonds.operator.maintenance.enableTitle'
    }),
  subtitle: ({ nodeLabel }) => nodeLabel,
  cta: ({ intl, node }) =>
    intl.formatMessage({
      id: node.maintenance ? 'bonds.operator.maintenance.signDisable' : 'bonds.operator.maintenance.signEnable'
    }),
  memo: ({ node }) => getMaintenanceMemo(node.address),
  validate: () => ({ error: null, complete: true }),
  settled: ({ node }, _input, fresh) => fresh.maintenance !== node.maintenance,
  Summary: MaintenanceSummary
}
