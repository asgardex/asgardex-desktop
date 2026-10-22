import { useMemo } from 'react'

import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import type { NextChurn } from '../../../hooks/useNextChurn'
import { NodeInfo } from '../../../services/thorchain/types'
import { Tooltip } from '../../uielements/tooltip'
import {
  outlookFactLabel,
  outlookFactValue,
  outlookReasonMessage,
  outlookVerdictMessage,
  outlookWhyMessage
} from './churnOutlookMessages'
import { formatCountdown } from './helpers'
import { ChurnOutlook, NodeNetworkContext, OutlookReason, OutlookVerdict, churnOutlook } from './nodeNetwork'

type Props = {
  node: NodeInfo
  ctx: O.Option<NodeNetworkContext>
  nextChurn: O.Option<NextChurn>
  isPrivate: boolean
}

const OUTLOOK_VERDICT_CLASSES: Record<OutlookVerdict, string> = {
  likelyIn: 'text-turquoise',
  likelyStays: 'text-turquoise',
  watch: 'text-warning0 dark:text-warning0d',
  likelyOut: 'text-error0 dark:text-error0d',
  blocked: 'text-warning0 dark:text-warning0d',
  leaving: 'text-gray2 dark:text-gray2d',
  unknown: 'text-gray2 dark:text-gray2d'
}

const SEVERITY_COLOR: Record<OutlookReason['severity'], string> = {
  risk: 'text-error0 dark:text-error0d',
  warn: 'text-warning0 dark:text-warning0d',
  info: 'text-text0 dark:text-text0d'
}

const useChurnOutlook = (node: NodeInfo, ctx: O.Option<NodeNetworkContext>): O.Option<ChurnOutlook> =>
  useMemo(
    () =>
      FP.pipe(
        ctx,
        O.map((context) => churnOutlook(node, context))
      ),
    [ctx, node]
  )

type TagProps = {
  node: NodeInfo
  ctx: O.Option<NodeNetworkContext>
  isPrivate: boolean
  churnHalted?: boolean
  className?: string
}

const HALTED_CLASSES = 'text-warning0 dark:text-warning0d'

export const ChurnOutlookTag = ({ node, ctx, isPrivate, churnHalted = false, className }: TagProps) => {
  const intl = useIntl()
  const oOutlook = useChurnOutlook(node, ctx)

  return FP.pipe(
    oOutlook,
    O.fold(
      () => null,
      (outlook) => {
        const why = outlookWhyMessage(outlook, intl, { isPrivate })
        const whyFromTopReason = outlook.verdict !== 'unknown' && outlook.verdict !== 'likelyStays'
        const facts = outlook.reasons
          .filter((reason, index) => reason.severity !== 'info' && !(whyFromTopReason && index === 0))
          .map((reason) => outlookReasonMessage(reason, intl, { verdict: outlook.verdict, isPrivate }))
          .filter((fact) => fact !== why)
        const verdict = outlookVerdictMessage(outlook.verdict, intl)
        const lines = churnHalted
          ? [intl.formatMessage({ id: 'bonds.churn.haltedThen' }, { verdict }), why, ...facts]
          : [why, ...facts]
        return (
          <Tooltip size="big" title={lines.join('\n')}>
            <span
              className={clsx(
                'font-main-semi-bold text-[13px] whitespace-nowrap',
                churnHalted ? HALTED_CLASSES : OUTLOOK_VERDICT_CLASSES[outlook.verdict],
                className
              )}>
              {churnHalted ? intl.formatMessage({ id: 'bonds.churn.halted' }) : verdict}
            </span>
          </Tooltip>
        )
      }
    )
  )
}

export const ChurnOutlookCard = ({ node, ctx, nextChurn, isPrivate }: Props) => {
  const intl = useIntl()
  const oOutlook = useChurnOutlook(node, ctx)

  const churnHalted = FP.pipe(
    nextChurn,
    O.exists(({ halted }) => halted)
  )
  const countdown = FP.pipe(
    nextChurn,
    O.map((churn) =>
      churn.halted
        ? intl.formatMessage({ id: 'bonds.churn.halted' })
        : intl.formatMessage({ id: 'bonds.outlook.nextChurnIn' }, { time: formatCountdown(churn.msLeft) })
    ),
    O.toUndefined
  )

  return (
    <div className="flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
      <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
        {intl.formatMessage({ id: 'bonds.outlook.title' })}
        {countdown && <span className="font-main tracking-normal normal-case">{` · ${countdown}`}</span>}
      </span>
      {FP.pipe(
        oOutlook,
        O.fold(
          () => (
            <span className="mt-4 font-main text-[13px] text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'bonds.outlook.loading' })}
            </span>
          ),
          (outlook) => (
            <>
              <Tooltip size="big" title={outlookWhyMessage(outlook, intl, { isPrivate })}>
                <span
                  className={clsx(
                    'mt-4 inline-block font-main-bold text-[20px] leading-tight',
                    churnHalted ? HALTED_CLASSES : OUTLOOK_VERDICT_CLASSES[outlook.verdict]
                  )}>
                  {churnHalted
                    ? intl.formatMessage({ id: 'bonds.churn.halted' })
                    : outlookVerdictMessage(outlook.verdict, intl)}
                </span>
              </Tooltip>
              {churnHalted && (
                <span className="mt-1 font-main text-[13px] text-gray2 dark:text-gray2d">
                  {intl.formatMessage(
                    { id: 'bonds.churn.haltedThen' },
                    { verdict: outlookVerdictMessage(outlook.verdict, intl) }
                  )}
                </span>
              )}
              {outlook.reasons.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-solid border-gray0 pt-4 sm:grid-cols-3 dark:border-gray0d">
                  {outlook.reasons.map((reason) => {
                    const { value, sub } = outlookFactValue(reason, intl, { verdict: outlook.verdict, isPrivate })
                    const wide = reason.kind === 'preflight'
                    const fact = (
                      <div className="flex min-w-0 flex-col">
                        <span className="font-main-semi-bold text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
                          {outlookFactLabel(reason, intl)}
                        </span>
                        <span
                          className={clsx(
                            'leading-tight',
                            wide ? 'font-main text-[13px]' : 'truncate font-main-bold text-[18px]',
                            SEVERITY_COLOR[reason.severity]
                          )}>
                          {value}
                        </span>
                        {sub && (
                          <span className="truncate font-main text-[12px] text-gray2 dark:text-gray2d">{sub}</span>
                        )}
                      </div>
                    )
                    return wide ? (
                      <div key={reason.kind} className="col-span-2 sm:col-span-3">
                        {fact}
                      </div>
                    ) : (
                      <Tooltip
                        key={reason.kind}
                        size="big"
                        title={outlookReasonMessage(reason, intl, { verdict: outlook.verdict, isPrivate })}>
                        {fact}
                      </Tooltip>
                    )
                  })}
                </div>
              )}
            </>
          )
        )
      )}
    </div>
  )
}
