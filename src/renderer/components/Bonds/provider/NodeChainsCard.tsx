import { useMemo } from 'react'

import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { NodeInfo } from '../../../services/thorchain/types'
import { ChainLag, NodeNetworkContext, chainHeights, chainLag, chainLagThreshold } from './nodeNetwork'

const CHAIN_LAG_RISK_FACTOR = 6

type LagLevel = 0 | 1 | 2

const lagLevel = ({ chain, lag }: ChainLag): LagLevel => {
  const threshold = chainLagThreshold(chain)
  if (lag <= threshold) return 0
  return lag <= threshold * CHAIN_LAG_RISK_FACTOR ? 1 : 2
}

const DOT_CLASSES: Record<LagLevel, string> = {
  0: 'bg-gray1 dark:bg-gray1d',
  1: 'bg-warning0 dark:bg-warning0d',
  2: 'bg-error0 dark:bg-error0d'
}

const TEXT_CLASSES: Record<LagLevel, string> = {
  0: 'text-gray2 dark:text-gray2d',
  1: 'text-warning0 dark:text-warning0d',
  2: 'text-error0 dark:text-error0d'
}

type Props = {
  node: NodeInfo
  ctx: O.Option<NodeNetworkContext>
}

export const NodeChainsCard = ({ node, ctx }: Props) => {
  const intl = useIntl()

  const rows = useMemo(
    () =>
      FP.pipe(
        ctx,
        O.map(({ nodes }) => chainLag(node, chainHeights(nodes))),
        O.getOrElse(() => chainLag(node, new Map<string, number>()))
      ).map((row) => ({ ...row, level: lagLevel(row) })),
    [ctx, node]
  )

  const behind = rows.filter(({ level }) => level > 0).length
  const worst = rows.reduce<LagLevel>((acc, { level }) => (level > acc ? level : acc), 0)

  const lagText = ({ lag, level }: ChainLag & { level: LagLevel }) => {
    const value = intl.formatNumber(lag)
    if (lag === 0) return intl.formatMessage({ id: 'bonds.chains.inSync' })
    return level === 0
      ? intl.formatMessage({ id: 'bonds.chains.behindOk' }, { lag: value })
      : intl.formatMessage({ id: 'bonds.chains.behind' }, { lag: value })
  }

  return (
    <div className="flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
      <div className="flex min-h-[32px] items-center justify-between gap-3">
        <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.chains.title' })}
        </span>
        {rows.length > 0 && O.isSome(ctx) && (
          <span className={clsx('font-main-semi-bold text-[12px] tracking-[1px] uppercase', TEXT_CLASSES[worst])}>
            {behind === 0
              ? intl.formatMessage({ id: 'bonds.chains.allInSync' })
              : intl.formatMessage({ id: 'bonds.chains.behindCount' }, { count: behind })}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <span className="mt-4 font-main text-[13px] text-gray2 dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.chains.empty' })}
        </span>
      ) : (
        <div className="mt-3 flex flex-col">
          {rows.map((row) => (
            <div
              key={row.chain}
              className="grid grid-cols-[minmax(56px,1fr)_minmax(0,2fr)_minmax(0,2fr)] items-center gap-3 border-b border-solid border-gray0 py-2 last:border-b-0 dark:border-gray0d">
              <span className="font-main-semi-bold text-[13px] text-text0 dark:text-text0d">{row.chain}</span>
              <span className="font-main text-[13px] text-gray2 tabular-nums dark:text-gray2d">
                {intl.formatNumber(row.height)}
              </span>
              <span
                className={clsx(
                  'flex items-center justify-end gap-1.5 font-main text-[12px]',
                  TEXT_CLASSES[row.level]
                )}>
                <span className={clsx('inline-block h-1.5 w-1.5 rounded-full', DOT_CLASSES[row.level])} />
                {lagText(row)}
              </span>
            </div>
          ))}
        </div>
      )}
      <span className="mt-auto pt-4 font-main text-[11px] leading-relaxed text-gray2 dark:text-gray2d">
        {intl.formatMessage({ id: 'bonds.chains.caption' })}
      </span>
    </div>
  )
}
