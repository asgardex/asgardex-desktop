import { baseToAsset } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { hiddenString } from '../../../helpers/stringHelper'
import { NodeHistoryRD } from '../../../services/runebond'
import { ChurnBars } from './ChurnBars'
import { formatChurnDate, formatRuneAmount } from './helpers'
import { NodeHistoryCard } from './NodeHistoryCard'

type Props = {
  historyRD: NodeHistoryRD
  isPrivate: boolean
}

export const NodeOperatorEarningsCard = ({ historyRD, isPrivate }: Props) => {
  const intl = useIntl()

  return (
    <NodeHistoryCard
      title={intl.formatMessage({ id: 'bonds.operator.detail.nodeEarnings' })}
      extra={
        <span className="font-main text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.provider.rewards.perChurn' })}
        </span>
      }
      historyRD={historyRD}
      hasData={({ nodeEarningsSeries }) => nodeEarningsSeries.length > 0}>
      {({ nodeEarningsSeries }) => (
        <div className="mt-4 flex min-h-[220px] flex-1 flex-col">
          <div className="min-h-[180px] w-full flex-1">
            <ChurnBars
              bars={nodeEarningsSeries.map(({ amount, date }) => ({
                value: baseToAsset(amount).amount().toNumber(),
                label: (
                  <div className="flex flex-col gap-[2px]">
                    <span className="text-gray1d">{formatChurnDate(date, intl.locale)}</span>
                    <span>ᚱ{isPrivate ? hiddenString : formatRuneAmount(amount)}</span>
                  </div>
                )
              }))}
            />
          </div>
          <div className="mt-3 flex items-center justify-between font-main text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
            <span>
              {intl.formatMessage({ id: 'bonds.provider.detail.churnsAgo' }, { count: nodeEarningsSeries.length })}
            </span>
            <span>
              {intl.formatMessage({ id: 'bonds.operator.detail.lastChurn' })}{' '}
              <span className="text-text0 dark:text-text0d">
                ᚱ
                {isPrivate
                  ? hiddenString
                  : FP.pipe(
                      A.last(nodeEarningsSeries),
                      O.fold(
                        () => '—',
                        ({ amount }) => formatRuneAmount(amount)
                      )
                    )}
              </span>
            </span>
          </div>
        </div>
      )}
    </NodeHistoryCard>
  )
}
