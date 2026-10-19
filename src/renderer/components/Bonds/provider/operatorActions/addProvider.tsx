import { getBondMemo } from '../../../../helpers/memoHelper'
import { NodeInfo } from '../../../../services/thorchain/types'
import { Input } from '../../../uielements/input'
import { OPERATOR_BOND_ACTION_AMOUNT, formatBpsAsPercent } from '../helpers'
import { AttachedRow, SummaryRow } from './SummaryRow'
import {
  OperatorActionContext,
  OperatorActionFieldProps,
  OperatorActionInput,
  OperatorActionSpec,
  OperatorActionSummaryProps
} from './types'

const amount = OPERATOR_BOND_ACTION_AMOUNT

const inputProviderAddress = ({ provider }: OperatorActionInput): string => provider.trim()

const isListed = (node: NodeInfo, address: string): boolean =>
  node.bondProviders.providers.some(({ bondAddress }) => bondAddress.toLowerCase() === address.toLowerCase())

const providerError = (ctx: OperatorActionContext, address: string): string | null => {
  const { intl, node, validateAddress } = ctx
  if (address === '') return null
  if (!validateAddress(address)) return intl.formatMessage({ id: 'wallet.errors.address.invalid' })
  if (isListed(node, address)) return intl.formatMessage({ id: 'bonds.operator.addProvider.alreadyListed' })
  return null
}

const AddProviderField = ({
  ctx: { intl, currentFeeBps },
  input,
  error,
  disabled,
  onChange
}: OperatorActionFieldProps) => (
  <>
    <span className="mt-6 font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
      {intl.formatMessage({ id: 'bonds.operator.addProvider.label' })}
    </span>
    <Input
      className="mt-2"
      autoFocus
      size="large"
      disabled={disabled}
      placeholder="thor1…"
      value={input.provider}
      error={error !== null}
      onChange={(event) => onChange({ provider: event.target.value })}
    />
    <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">
      {error ??
        intl.formatMessage(
          { id: 'bonds.operator.addProvider.hint' },
          { fee: formatBpsAsPercent(currentFeeBps, intl.locale) }
        )}
    </span>
  </>
)

const AddProviderSummary = ({ ctx: { intl, node, maxBondProviders } }: OperatorActionSummaryProps) => {
  const free = Math.max(maxBondProviders - node.bondProviders.providers.length - 1, 0)
  return (
    <>
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.addProvider.slotsAfter' })}
        value={
          maxBondProviders > 0
            ? intl.formatMessage({ id: 'bonds.operator.addProvider.slotsFree' }, { count: free })
            : '—'
        }
      />
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.operator.addProvider.mustBond' })}
        value={intl.formatMessage({ id: 'bonds.operator.addProvider.mustBondValue' })}
      />
      <AttachedRow intl={intl} amount={amount} />
    </>
  )
}

export const addProviderSpec: OperatorActionSpec = {
  amount,
  danger: false,
  title: ({ intl }) => intl.formatMessage({ id: 'bonds.operator.addProvider.modalTitle' }),
  subtitle: ({ nodeLabel }) => nodeLabel,
  cta: ({ intl }) => intl.formatMessage({ id: 'bonds.operator.addProvider.sign' }),
  memo: (ctx, input) => {
    const address = inputProviderAddress(input)
    return getBondMemo(
      ctx.node.address,
      address !== '' && !providerError(ctx, address)
        ? address
        : ctx.intl.formatMessage({ id: 'bonds.operator.addProvider.placeholder' })
    )
  },
  validate: (ctx, input) => {
    const address = inputProviderAddress(input)
    const error = providerError(ctx, address)
    return { error, complete: address !== '' && error === null }
  },
  settled: (_ctx, input, fresh) => isListed(fresh, inputProviderAddress(input)),
  Field: AddProviderField,
  Summary: AddProviderSummary
}
