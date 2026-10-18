import { BaseAmount } from '@xchainjs/xchain-util'
import { useIntl } from 'react-intl'

import { hiddenString } from '../../../helpers/stringHelper'
import { NodeProviders } from '../../../services/runebond'
import { formatChurnDate, formatRuneAmount } from './helpers'

type Props = {
  providerMeta: NodeProviders
  bondAddress: string
  bond: BaseAmount
  isPrivate: boolean
}

export const BondProviderMeta = ({ providerMeta, bondAddress, bond, isPrivate }: Props) => {
  const intl = useIntl()

  const entry = providerMeta.providers.find(
    ({ providerAddress }) => providerAddress.toLowerCase() === bondAddress.toLowerCase()
  )
  if (!entry) return null

  const idle = entry.bondAmount.lte(0)
  if (idle !== bond.lte(0)) return null

  const text = (() => {
    if (idle) return intl.formatMessage({ id: 'bonds.providerMeta.idle' }, { count: entry.churnsSinceFirstSeen })
    const since = intl.formatMessage({ id: 'bonds.providerMeta.since' }, { count: entry.churnsSinceFirstSeen })
    const { lastPayout } = entry
    if (!lastPayout) return since
    const amount = isPrivate ? hiddenString : formatRuneAmount(lastPayout.amount)
    const paid =
      lastPayout.blockNumber === providerMeta.blockNumber
        ? intl.formatMessage({ id: 'bonds.providerMeta.paidLastChurn' }, { amount })
        : intl.formatMessage(
            { id: 'bonds.providerMeta.lastPaid' },
            { amount, date: formatChurnDate(lastPayout.date, intl.locale) }
          )
    return `${since} · ${paid}`
  })()

  return <span className="truncate font-main text-[12px] text-gray2 dark:text-gray2d">{text}</span>
}
