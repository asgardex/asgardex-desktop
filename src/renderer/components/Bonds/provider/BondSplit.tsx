import { Network } from '@xchainjs/xchain-client'
import { BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { hiddenString } from '../../../helpers/stringHelper'
import { Providers } from '../../../services/thorchain/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { PieChart } from '../../uielements/charts'
import { ChartColors } from '../../uielements/charts/utils'
import { formatRuneAmount } from './helpers'

const MAX_PROVIDER_SLICES = 4

type Props = {
  network: Network
  isPrivate: boolean
  providers: Providers[]
  nodeBond: BaseAmount
  providerName: (address: string) => string
  layout: 'card' | 'row'
}

export const BondSplit = ({ network, isPrivate, providers, nodeBond, providerName, layout }: Props) => {
  const intl = useIntl()

  const percentOf = (amount: BaseAmount) =>
    nodeBond.gt(0) ? `${baseToAsset(amount).amount().div(baseToAsset(nodeBond).amount()).times(100).toFixed(0)}%` : '0%'

  const named = providers.slice(0, MAX_PROVIDER_SLICES)
  const others = providers.slice(MAX_PROVIDER_SLICES)
  const othersTotal = others.reduce((acc, { bond }) => acc.plus(bond), ZERO_BASE_AMOUNT)
  const split = [
    ...named.map((provider) => ({ name: providerName(provider.bondAddress), amount: provider.bond })),
    ...(others.length > 0
      ? [
          {
            name: intl.formatMessage({ id: 'bonds.provider.detail.others' }, { count: others.length }),
            amount: othersTotal
          }
        ]
      : [])
  ]

  const chartData = split.map(({ name, amount }) => ({
    name,
    value: parseFloat(baseToAsset(amount).amount().toFixed(0))
  }))

  const legend = [...split]
    .sort((a, b) => (b.amount.gt(a.amount) ? 1 : b.amount.lt(a.amount) ? -1 : 0))
    .map((entry, index) => ({ ...entry, color: ChartColors[index % ChartColors.length] }))

  const ring = (
    <div className={clsx('h-[200px] w-[200px]', layout === 'card' ? 'mx-auto mt-4' : 'mx-auto shrink-0 lg:mx-8')}>
      <PieChart
        chartData={chartData}
        isPrivate={isPrivate}
        isLegendHidden
        formatValue={(value) =>
          intl.formatMessage(
            { id: 'bonds.provider.detail.bondedAmount' },
            { amount: value.toLocaleString(intl.locale, { maximumFractionDigits: 0 }) }
          )
        }
      />
    </div>
  )

  const entries = (
    <div className="mt-4 flex flex-col gap-2">
      {legend.map(({ name, amount, color }, index) => (
        <div key={`${name}-${index}`} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 font-main text-[13px] text-text0 dark:text-text0d">
            <span className="inline-block h-[10px] w-[10px] shrink-0 rounded-sm" style={{ backgroundColor: color }} />
            <span className="truncate">{name}</span>
          </span>
          <span className="shrink-0 font-main-semi-bold text-[13px] text-text0 dark:text-text0d">
            {percentOf(amount)}
          </span>
        </div>
      ))}
    </div>
  )

  if (layout === 'card') {
    return (
      <div className="flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
        <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.provider.detail.bondSplit' })}
        </span>
        {ring}
        {entries}
      </div>
    )
  }

  return (
    <div className="mt-6 flex w-full flex-col gap-8 rounded-lg border border-solid border-gray0 bg-bg0 p-6 lg:flex-row lg:items-center dark:border-gray0d dark:bg-bg0d">
      {ring}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.provider.detail.providersTitle' })}
          {`· ${providers.length} ·`}
          <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
          <span className="text-text0 dark:text-text0d">{isPrivate ? hiddenString : formatRuneAmount(nodeBond)}</span>
        </span>
        {entries}
      </div>
    </div>
  )
}
