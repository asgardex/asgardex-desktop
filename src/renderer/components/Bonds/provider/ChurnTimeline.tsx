import * as RD from '@devexperts/remote-data-ts'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { hiddenString } from '../../../helpers/stringHelper'
import { ChurnPoint, NodeHistoryRD } from '../../../services/runebond'
import { Tooltip } from '../../uielements/tooltip'
import { formatChurnDate, formatRuneAmount } from './helpers'

type Props = {
  historyRD: NodeHistoryRD
  isPrivate: boolean
  className?: string
}

const isActiveChurn = ({ amount }: ChurnPoint): boolean => amount.gt(0)

const LegendDot = ({ filled }: { filled: boolean }) => (
  <span
    className={clsx(
      'inline-block h-[8px] w-[8px] rounded-sm border border-solid',
      filled ? 'border-turquoise bg-turquoise' : 'border-gray1 dark:border-gray1d'
    )}
  />
)

export const ChurnTimeline = ({ historyRD, isPrivate, className }: Props) => {
  const intl = useIntl()

  const renderTimeline = (points: ChurnPoint[]) => {
    const activeCount = points.filter(isActiveChurn).length
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
            {intl.formatMessage({ id: 'bonds.timeline.title' })}
          </span>
          <div className="flex items-center gap-3 font-main text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
            <span className="flex items-center gap-1">
              <LegendDot filled />
              {intl.formatMessage({ id: 'bonds.timeline.active' })}
            </span>
            <span className="flex items-center gap-1">
              <LegendDot filled={false} />
              {intl.formatMessage({ id: 'bonds.timeline.notActive' })}
            </span>
            {points.length > 0 && (
              <span className="tracking-normal text-text0 normal-case dark:text-text0d">
                {intl.formatMessage({ id: 'bonds.timeline.summary' }, { count: activeCount, total: points.length })}
              </span>
            )}
          </div>
        </div>
        {points.length === 0 ? (
          <span className="mt-3 font-main text-[13px] text-gray2 dark:text-gray2d">
            {intl.formatMessage({ id: 'bonds.timeline.empty' })}
          </span>
        ) : (
          <>
            <div
              className="mt-3 grid gap-1"
              style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
              {points.map((point) => {
                const active = isActiveChurn(point)
                const date = formatChurnDate(point.date, intl.locale)
                const title = active
                  ? intl.formatMessage(
                      { id: 'bonds.timeline.tooltipActive' },
                      { date, amount: isPrivate ? hiddenString : formatRuneAmount(point.amount) }
                    )
                  : intl.formatMessage({ id: 'bonds.timeline.tooltipInactive' }, { date })
                return (
                  <Tooltip key={point.churnHeight} size="big" title={title}>
                    <div
                      className={clsx(
                        'h-[10px] w-full rounded-sm border border-solid transition-opacity hover:opacity-70',
                        active ? 'border-turquoise bg-turquoise' : 'border-gray1 dark:border-gray1d'
                      )}
                    />
                  </Tooltip>
                )
              })}
            </div>
            <div className="mt-1 flex justify-between font-main text-[10px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
              <span>{intl.formatMessage({ id: 'bonds.timeline.first' }, { count: points.length })}</span>
              <span>{intl.formatMessage({ id: 'bonds.timeline.last' })}</span>
            </div>
          </>
        )}
      </>
    )
  }

  return FP.pipe(
    historyRD,
    RD.fold(
      () => <></>,
      () => (
        <div
          className={clsx(
            'h-[86px] w-full animate-pulse rounded-lg border border-solid border-gray0 bg-bg0 dark:border-gray0d dark:bg-bg0d',
            className
          )}
        />
      ),
      () => <></>,
      ({ nodeEarningsSeries }) => (
        <div
          className={clsx(
            'flex w-full flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d',
            className
          )}>
          {renderTimeline(nodeEarningsSeries)}
        </div>
      )
    )
  )
}
