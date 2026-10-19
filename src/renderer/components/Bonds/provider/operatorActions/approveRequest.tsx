import { THORChain } from '../../../../../shared/utils/chainIds'

import { truncateAddress } from '../../../../helpers/addressHelper'
import { getBondMemo } from '../../../../helpers/memoHelper'
import { hiddenString } from '../../../../helpers/stringHelper'
import { WhitelistRequest } from '../../../../services/runebond'
import { useApp } from '../../../../store/app/hooks'
import {
  OPERATOR_BOND_ACTION_AMOUNT,
  addressExplorerUrl,
  formatChurnDate,
  formatRuneAmount,
  hasBondProvider
} from '../helpers'
import { AttachedRow, SummaryRow } from './SummaryRow'
import {
  OperatorActionContext,
  OperatorActionFieldProps,
  OperatorActionSpec,
  OperatorActionSummaryProps
} from './types'

const amount = OPERATOR_BOND_ACTION_AMOUNT

const providerError = ({ intl, node, validateAddress }: OperatorActionContext, address: string): string | null => {
  if (!validateAddress(address)) return intl.formatMessage({ id: 'wallet.errors.address.invalid' })
  if (hasBondProvider(node, address)) return intl.formatMessage({ id: 'bonds.operator.addProvider.alreadyListed' })
  return null
}

const ApproveRequestField = ({
  ctx: { intl },
  error,
  request
}: OperatorActionFieldProps & { request: WhitelistRequest }) => (
  <>
    <span className="mt-6 font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
      {intl.formatMessage({ id: 'bonds.runebond.approve.provider' })}
    </span>
    <button
      type="button"
      title={intl.formatMessage({ id: 'bonds.provider.detail.viewOnExplorer' })}
      className="mt-1.5 cursor-pointer rounded-lg border border-solid border-gray1 bg-transparent px-4 py-3 text-left font-mono text-[13px] break-all text-text0 hover:text-turquoise dark:border-gray0d dark:text-text0d dark:hover:text-turquoise"
      onClick={() => window.apiUrl.openExternal(addressExplorerUrl(request.providerAddress))}>
      {request.providerAddress}
    </button>
    {error && <span className="mt-2 font-main text-[14px] text-error0 dark:text-error0d">{error}</span>}
  </>
)

const ApproveRequestSummary = ({
  ctx: { intl },
  request
}: OperatorActionSummaryProps & { request: WhitelistRequest }) => {
  const { isPrivate } = useApp()
  return (
    <>
      <SummaryRow
        label={intl.formatMessage({ id: 'bonds.runebond.approve.wants' })}
        value={`${isPrivate ? hiddenString : formatRuneAmount(request.intendedBond)} RUNE`}
      />
      <AttachedRow intl={intl} amount={amount} />
    </>
  )
}

export const approveRequestSpec = (request: WhitelistRequest): OperatorActionSpec => ({
  amount,
  danger: false,
  title: ({ intl }) => intl.formatMessage({ id: 'bonds.runebond.approve.title' }),
  subtitle: ({ intl, network }) =>
    intl.formatMessage(
      { id: 'bonds.runebond.approve.subtitle' },
      {
        provider: truncateAddress(request.providerAddress, THORChain, network),
        date: formatChurnDate(request.requestedDate, intl.locale)
      }
    ),
  cta: ({ intl }) => intl.formatMessage({ id: 'bonds.runebond.approve.sign' }),
  memo: ({ node }) => getBondMemo(node.address, request.providerAddress),
  validate: (ctx) => {
    const error = providerError(ctx, request.providerAddress)
    return { error, complete: error === null }
  },
  settled: (_ctx, _input, fresh) => hasBondProvider(fresh, request.providerAddress),
  Field: (props) => <ApproveRequestField {...props} request={request} />,
  Summary: (props) => <ApproveRequestSummary {...props} request={request} />
})
