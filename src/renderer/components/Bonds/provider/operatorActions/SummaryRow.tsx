import { BaseAmount } from '@xchainjs/xchain-util'
import { IntlShape } from 'react-intl'

import { formatRuneAmount } from '../helpers'

export const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="font-main text-[14px] text-text0 dark:text-text0d">{label}</span>
    <span className="text-right font-main-semi-bold text-[14px] text-text0 dark:text-text0d">{value}</span>
  </div>
)

export const AttachedRow = ({ intl, amount }: { intl: IntlShape; amount: BaseAmount }) => (
  <SummaryRow
    label={intl.formatMessage({ id: 'bonds.operator.modal.attached' })}
    value={intl.formatMessage({ id: 'bonds.operator.modal.attachedValue' }, { amount: formatRuneAmount(amount) })}
  />
)
