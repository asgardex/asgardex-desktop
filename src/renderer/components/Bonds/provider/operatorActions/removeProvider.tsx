import { THORChain } from '../../../../../shared/utils/chainIds'

import { ZERO_BASE_AMOUNT } from '../../../../const'
import { truncateAddress } from '../../../../helpers/addressHelper'
import { getUnbondMemo } from '../../../../helpers/memoHelper'
import { Providers } from '../../../../services/thorchain/types'
import { formatRuneAmount } from '../helpers'
import { SummaryRow } from './SummaryRow'
import { OperatorActionSpec, OperatorActionSummaryProps } from './types'

const RemoveProviderSummary = ({ ctx: { intl }, provider }: OperatorActionSummaryProps & { provider: Providers }) => (
  <>
    <SummaryRow
      label={intl.formatMessage({ id: 'bonds.operator.removeProvider.theirBond' })}
      value={
        provider.bond.gt(0)
          ? intl.formatMessage(
              { id: 'bonds.operator.removeProvider.theirBondReturned' },
              { amount: formatRuneAmount(provider.bond) }
            )
          : `${formatRuneAmount(provider.bond)} RUNE`
      }
    />
    <SummaryRow
      label={intl.formatMessage({ id: 'bonds.operator.removeProvider.slot' })}
      value={intl.formatMessage({ id: 'bonds.operator.removeProvider.slotValue' })}
    />
  </>
)

export const removeProviderSpec = (provider: Providers): OperatorActionSpec => ({
  amount: ZERO_BASE_AMOUNT,
  danger: true,
  title: ({ intl }) => intl.formatMessage({ id: 'bonds.operator.removeProvider.modalTitle' }),
  subtitle: ({ network }) => truncateAddress(provider.bondAddress, THORChain, network),
  cta: ({ intl }) => intl.formatMessage({ id: 'bonds.operator.removeProvider.sign' }),
  memo: ({ node }) => getUnbondMemo(node.address, ZERO_BASE_AMOUNT, provider.bondAddress),
  validate: () => ({ error: null, complete: true }),
  settled: (_ctx, _input, fresh) =>
    !fresh.bondProviders.providers.some(
      ({ bondAddress }) => bondAddress.toLowerCase() === provider.bondAddress.toLowerCase()
    ),
  Summary: (props) => <RemoveProviderSummary {...props} provider={provider} />
})
