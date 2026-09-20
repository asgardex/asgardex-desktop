import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { NodeHistoryRD } from '../../../services/runebond'
import { formatChurnDate } from './helpers'
import { NodeHistoryCard } from './NodeHistoryCard'
import { SparkLine } from './SparkLine'

type Props = {
  historyRD: NodeHistoryRD
  /** already formatted APY of the last churn, e.g. "21.4%" */
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
      // a line needs two points
      hasData={({ apySeries }) => apySeries.length >= 2}>
      {({ apySeries }) => (
        <div className="mt-4 flex min-h-[220px] flex-1 flex-col">
          <div className="min-h-[180px] w-full flex-1">
            <SparkLine
              values={apySeries.map(({ apy }) => apy)}
              labels={apySeries.map(
                ({ apy, date }) => `${(apy * 100).toFixed(1)}% · ${formatChurnDate(date, intl.locale)}`
              )}
              showLastDot
            />
          </div>
        </div>
      )}
    </NodeHistoryCard>
  )
}
