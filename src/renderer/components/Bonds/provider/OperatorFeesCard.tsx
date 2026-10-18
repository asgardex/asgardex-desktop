import { ReactNode } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address, BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ZERO_BASE_AMOUNT } from '../../../const'
import { hiddenString } from '../../../helpers/stringHelper'
import { useOperatorFees } from '../../../hooks/useOperatorFees'
import { NodeHistoryRD, OperatorRewards, OperatorRewardsRD } from '../../../services/runebond'
import { InfoIcon } from '../../uielements/info'
import { Spin } from '../../uielements/spin'
import { ChurnBars } from './ChurnBars'
import { formatBpsAsPercent, formatChurnDate, formatRuneAmount } from './helpers'
import { RunebondUnavailablePanel } from './RunebondUnavailablePanel'

type Props = {
  operatorAddress: Address
  nodeAddress: Address
  historyRD: NodeHistoryRD
  isPrivate: boolean
  className?: string
}

type FeePoint = {
  date: Date
  amount: BaseAmount
  bps: number | null
  unknown: boolean
}

const Centered = ({ children }: { children: ReactNode }) => (
  <div className="mt-4 flex min-h-[220px] flex-1 items-center justify-center">{children}</div>
)

export const OperatorFeesCard = ({ operatorAddress, nodeAddress, historyRD, isPrivate, className }: Props) => {
  const intl = useIntl()
  const rewardsRD = useOperatorFees([operatorAddress])

  const stateRD: OperatorRewardsRD = RD.isPending(historyRD) ? RD.pending : rewardsRD

  const toSeries = (rewards: OperatorRewards): FeePoint[] => {
    const payouts = rewards.payouts.filter((payout) => payout.nodeAddress === nodeAddress)
    const truncated = rewards.payouts.length < rewards.payoutsTotal
    const oldestLoaded = rewards.payouts.reduce((min, { blockNumber }) => Math.min(min, blockNumber), Infinity)
    const churns = FP.pipe(
      historyRD,
      RD.map(({ nodeEarningsSeries }) => nodeEarningsSeries),
      RD.getOrElse(() => rewards.series)
    )
    return churns.map(({ churnHeight, date }) => {
      const atChurn = payouts.filter(({ blockNumber }) => blockNumber === churnHeight)
      return {
        date,
        amount: atChurn.reduce((acc, { commissionAmount }) => acc.plus(commissionAmount), ZERO_BASE_AMOUNT),
        bps: atChurn.length > 0 ? atChurn[0].commissionBps : null,
        unknown: truncated && churnHeight <= oldestLoaded && atChurn.length === 0
      }
    })
  }

  const renderChart = (rewards: OperatorRewards) => {
    const series = toSeries(rewards)
    if (series.length === 0) {
      return (
        <Centered>
          <span className="max-w-[320px] text-center font-main text-[14px] text-gray2 dark:text-gray2d">
            {intl.formatMessage({ id: 'bonds.provider.detail.noHistoryYet' })}
          </span>
        </Centered>
      )
    }
    const total = series.reduce((acc, { amount }) => acc.plus(amount), ZERO_BASE_AMOUNT)
    const knownChurns = series.filter(({ unknown }) => !unknown).length
    const last = series[series.length - 1]
    const amount = (value: BaseAmount) => (isPrivate ? hiddenString : formatRuneAmount(value))

    return (
      <div className="mt-4 flex min-h-[220px] flex-1 flex-col">
        <span className="font-main text-[13px] text-gray2 dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.operatorFees.card.total' }, { amount: amount(total), count: knownChurns })}
        </span>
        <div className="mt-3 min-h-[160px] w-full flex-1">
          <ChurnBars
            bars={series.map(({ date, amount: value, bps, unknown }) => ({
              value: baseToAsset(value).amount().toNumber(),
              unknown,
              label: (
                <div className="flex flex-col gap-[2px]">
                  <span className="text-gray1d">{formatChurnDate(date, intl.locale)}</span>
                  <span>
                    {unknown
                      ? intl.formatMessage({ id: 'bonds.operatorFees.card.notLoaded' })
                      : bps === null
                        ? intl.formatMessage({ id: 'bonds.operatorFees.card.noPayout' })
                        : intl.formatMessage(
                            { id: 'bonds.operatorFees.card.payout' },
                            { amount: amount(value), fee: formatBpsAsPercent(bps, intl.locale) }
                          )}
                  </span>
                </div>
              )
            }))}
          />
        </div>
        <div className="mt-3 flex items-center justify-between font-main text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
          <span>{intl.formatMessage({ id: 'bonds.provider.detail.churnsAgo' }, { count: series.length })}</span>
          <span>
            {intl.formatMessage({ id: 'bonds.operator.detail.lastChurn' })}{' '}
            <span className="text-text0 dark:text-text0d">ᚱ{amount(last.amount)}</span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d',
        className
      )}>
      <div className="flex min-h-[32px] items-center justify-between">
        <div className="flex items-center gap-2 font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.operatorFees.card.title' })}
          <InfoIcon tooltipSize="big" tooltip={intl.formatMessage({ id: 'bonds.operatorFees.card.info' })} />
        </div>
        <span className="font-main text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.operatorFees.card.paidToYou' })}
        </span>
      </div>
      {FP.pipe(
        stateRD,
        RD.fold(
          () => (
            <Centered>
              <Spin />
            </Centered>
          ),
          () => (
            <Centered>
              <Spin />
            </Centered>
          ),
          () => <RunebondUnavailablePanel className="mt-4 min-h-[220px] flex-1" />,
          renderChart
        )
      )}
    </div>
  )
}
