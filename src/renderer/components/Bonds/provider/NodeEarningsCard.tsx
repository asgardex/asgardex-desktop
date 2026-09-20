import { baseToAsset } from '@xchainjs/xchain-util'
import { useIntl } from 'react-intl'

import { hiddenString } from '../../../helpers/stringHelper'
import { NodeHistoryRD } from '../../../services/runebond'
import { ChurnBars } from './ChurnBars'
import { formatChurnDate, formatRuneAmount } from './helpers'
import { NodeHistoryCard } from './NodeHistoryCard'
import { SparkLine } from './SparkLine'

type Props = {
  historyRD: NodeHistoryRD
  isPrivate: boolean
  /** hovered churn, shared by the bars and the bond line drawn on top of them */
  activeIndex: number | null
  onActiveIndexChange: (index: number | null) => void
}

export const NodeEarningsCard = ({ historyRD, isPrivate, activeIndex, onActiveIndexChange }: Props) => {
  const intl = useIntl()

  return (
    <NodeHistoryCard
      title={intl.formatMessage({ id: 'bonds.provider.detail.earningsTitle' })}
      extra={
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-main text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
            <span className="inline-block h-[10px] w-[10px] rounded-sm bg-turquoise/40" />
            {intl.formatMessage({ id: 'bonds.provider.detail.earnings' })}
          </span>
          <span className="flex items-center gap-1 font-main text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
            <span className="inline-block h-[2px] w-[14px] bg-warning0" />
            {intl.formatMessage({ id: 'bonds.bond' })}
          </span>
        </div>
      }
      historyRD={historyRD}
      hasData={({ earningsSeries, bondSeries }) => earningsSeries.length > 0 || bondSeries.length >= 2}>
      {({ earningsSeries, bondSeries }) => (
        <div className="mt-4 flex min-h-[220px] flex-1 flex-col">
          <div className="relative min-h-[180px] w-full flex-1">
            <ChurnBars
              bars={earningsSeries.map(({ amount, date }, index) => ({
                value: baseToAsset(amount).amount().toNumber(),
                label: (
                  <div className="flex flex-col gap-[2px]">
                    <span className="text-gray1d">{formatChurnDate(date, intl.locale)}</span>
                    <span>
                      <span className="mr-1 inline-block h-[8px] w-[8px] rounded-sm bg-turquoise" />
                      {intl.formatMessage({ id: 'bonds.provider.detail.earnings' })} ᚱ
                      {isPrivate ? hiddenString : formatRuneAmount(amount)}
                    </span>
                    {bondSeries[index] && (
                      <span>
                        <span className="mr-1 inline-block h-[8px] w-[8px] rounded-sm bg-warning0" />
                        {intl.formatMessage({ id: 'bonds.bond' })} ᚱ
                        {isPrivate ? hiddenString : formatRuneAmount(bondSeries[index].bond)}
                      </span>
                    )}
                  </div>
                )
              }))}
              activeIndex={activeIndex}
              onActiveIndexChange={onActiveIndexChange}
            />
            <div className="pointer-events-none absolute inset-0">
              <SparkLine
                values={bondSeries.map(({ bond }) => baseToAsset(bond).amount().toNumber())}
                activeIndex={activeIndex}
                strokeClassName="text-warning0"
                strokeWidth={2}
              />
            </div>
          </div>
        </div>
      )}
    </NodeHistoryCard>
  )
}
