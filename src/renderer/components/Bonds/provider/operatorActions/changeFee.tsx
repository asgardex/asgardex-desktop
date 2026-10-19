import BigNumber from 'bignumber.js'

import { getOperatorFeeMemo } from '../../../../helpers/memoHelper'
import { InputBigNumber } from '../../../uielements/input'
import { MAX_FEE_BPS, OPERATOR_BOND_ACTION_AMOUNT, formatBpsAsPercent, operatorFeeBps } from '../helpers'
import { AttachedRow, SummaryRow } from './SummaryRow'
import {
  OperatorActionContext,
  OperatorActionFieldProps,
  OperatorActionInput,
  OperatorActionSpec,
  OperatorActionSummaryProps
} from './types'

const amount = OPERATOR_BOND_ACTION_AMOUNT

const inputFeeBps = ({ fee }: OperatorActionInput): number =>
  fee.times(100).integerValue(BigNumber.ROUND_HALF_UP).toNumber()

const isFeeInRange = (feeBps: number): boolean => Number.isFinite(feeBps) && feeBps >= 0 && feeBps <= MAX_FEE_BPS

const effectiveFeeBps = ({ currentFeeBps }: OperatorActionContext, input: OperatorActionInput): number => {
  const feeBps = inputFeeBps(input)
  return isFeeInRange(feeBps) ? feeBps : currentFeeBps
}

const ChangeFeeField = ({ ctx: { intl }, input, error, disabled, onChange }: OperatorActionFieldProps) => (
  <>
    <span className="mt-6 font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
      {intl.formatMessage({ id: 'bonds.operator.changeFee.label' })}
    </span>
    <div className="relative mt-2">
      <InputBigNumber
        value={input.fee}
        onChange={(fee) => onChange({ fee })}
        disabled={disabled}
        size="large"
        decimal={2}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-main-semi-bold text-[12px] text-gray2 uppercase dark:text-gray2d">
        %
      </span>
    </div>
    <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">
      {intl.formatMessage({ id: 'bonds.operator.changeFee.hint' })}
    </span>
    {error && <span className="mt-1 font-main text-[14px] text-error0 dark:text-error0d">{error}</span>}
  </>
)

const ChangeFeeSummary = ({ ctx, input }: OperatorActionSummaryProps) => {
  const { intl, node, isActive, nextChurnLabel } = ctx
  const otherProviders = node.bondProviders.providers.filter(
    ({ bondAddress }) => bondAddress.toLowerCase() !== node.nodeOperatorAddress.toLowerCase()
  ).length
  return (
    <>
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.changeFee.youKeep' })}
        value={intl.formatMessage(
          { id: 'bonds.operator.changeFee.youKeepValue' },
          { percent: formatBpsAsPercent(effectiveFeeBps(ctx, input), intl.locale) }
        )}
      />
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.changeFee.effective' })}
        value={intl.formatMessage({ id: 'bonds.operator.changeFee.effectiveValue' })}
      />
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.changeFee.paidOut' })}
        value={
          isActive
            ? intl.formatMessage({ id: 'bonds.operator.changeFee.paidOutValue' }, { churn: nextChurnLabel })
            : intl.formatMessage({ id: 'bonds.operator.changeFee.paidOutStandby' })
        }
      />
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.changeFee.othersAffected' })}
        value={intl.formatMessage({ id: 'bonds.operator.changeFee.othersAffectedValue' }, { count: otherProviders })}
      />
      <AttachedRow intl={intl} amount={amount} />
    </>
  )
}

export const changeFeeSpec: OperatorActionSpec = {
  amount,
  danger: false,
  title: ({ intl }) => intl.formatMessage({ id: 'bonds.operator.changeFee.modalTitle' }),
  subtitle: ({ intl, nodeLabel, currentFeeBps }) =>
    intl.formatMessage(
      { id: 'bonds.operator.changeFee.subtitle' },
      { node: nodeLabel, percent: formatBpsAsPercent(currentFeeBps, intl.locale) }
    ),
  cta: ({ intl }) => intl.formatMessage({ id: 'bonds.operator.changeFee.sign' }),
  memo: (ctx, input) => getOperatorFeeMemo(ctx.node.address, effectiveFeeBps(ctx, input)),
  validate: ({ intl, currentFeeBps }, input) => {
    const feeBps = inputFeeBps(input)
    const error = isFeeInRange(feeBps) ? null : intl.formatMessage({ id: 'bonds.operator.changeFee.range' })
    return { error, complete: error === null && feeBps !== currentFeeBps }
  },
  settled: (_ctx, input, fresh) => operatorFeeBps(fresh.bondProviders.nodeOperatorFee) === inputFeeBps(input),
  Field: ChangeFeeField,
  Summary: ChangeFeeSummary
}
