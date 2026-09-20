import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { NodeHistoryRD } from '../../../services/runebond'
import { formatApy, formatChurnDate } from './helpers'
import { NodeHistoryCard } from './NodeHistoryCard'
import { SparkLine } from './SparkLine'

type Props = {
  historyRD: NodeHistoryRD
  apyLabel: O.Option<string>
}

export const NodeApyCard = ({ historyRD, apyLabel }: Props) => {
  const intl = useIntl()

  return (
    <NodeHistoryCard
      title={intl.formatMessage({ id: 'bonds.provider.detail.nodeApy' })}
      extra={FP.pipe(
        apyLabel,
        O.fold(
          () => null,
          (label) => <span className="font-main-bold text-[24px] text-text0 dark:text-text0d">{label}</span>
        )
      )}
      historyRD={historyRD}
      hasData={({ apySeries }) => apySeries.length >= 2}>
      {({ apySeries }) => (
        <div className="mt-4 flex min-h-[220px] flex-1 flex-col">
          <div className="min-h-[180px] w-full flex-1">
            <SparkLine
              values={apySeries.map(({ apy }) => apy)}
              labels={apySeries.map(({ apy, date }) => `${formatApy(apy)} · ${formatChurnDate(date, intl.locale)}`)}
              showLastDot
            />
          </div>
        </div>
      )}
    </NodeHistoryCard>
  )
}
