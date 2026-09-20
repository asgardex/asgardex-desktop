import { useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowLeftIcon } from '@heroicons/react/20/solid'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { baseToAsset } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import {
  ChurnBars,
  RunebondUnavailablePanel,
  SegmentedTabs,
  formatChurnDate,
  formatRuneAmount
} from '../../../components/Bonds/provider'
import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { BaseButton } from '../../../components/uielements/button'
import { Spin } from '../../../components/uielements/spin'
import { truncateAddress } from '../../../helpers/addressHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { useNodeProviderRewards, useProviderRewards } from '../../../hooks/useRunebondRewards'
import * as bondsRoutes from '../../../routes/bonds'
import { NodeProviderRewards, ProviderRewards } from '../../../services/runebond'
import { useApp } from '../../../store/app/hooks'
import { useBondProviderData } from './useBondProviderData'

const PAYOUT_LIST_CHURNS = 10

enum RewardsTab {
  AllNodes = 'all',
  PerNode = 'perNode'
}

const formatRelativeTime = (date: Date, locale: string): string => {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
  const diffMs = date.getTime() - Date.now()
  const diffHours = Math.round(diffMs / 3600000)
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour')
  return rtf.format(Math.round(diffHours / 24), 'day')
}

const csvEscape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

export const BondRewardsView = (): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const { isPrivate } = useApp()

  const { network, walletInfos, formatPrice } = useBondProviderData()

  const providerAddresses = useMemo(() => walletInfos.map(({ address }) => address), [walletInfos])

  const rewardsRD = useProviderRewards(providerAddresses)
  const nodeRewardsRD = useNodeProviderRewards(providerAddresses)

  const [tab, setTab] = useState<RewardsTab>(RewardsTab.AllNodes)

  const goBack = useCallback(() => navigate(bondsRoutes.base.path()), [navigate])

  const exportCsv = useCallback((rewards: ProviderRewards) => {
    const header = 'date,node_address,amount_rune'
    const rows = rewards.payouts.map(({ date, nodeAddress, amount }) =>
      [date.toISOString(), csvEscape(nodeAddress), baseToAsset(amount).amount().toFixed(8)].join(',')
    )
    window.apiExport.saveCsv({
      fileName: `bond-rewards-${new Date().toISOString().slice(0, 10)}.csv`,
      content: [header, ...rows].join('\n')
    })
  }, [])

  const renderUnavailable = () => <RunebondUnavailablePanel className="min-h-[280px]" />

  const renderAllNodes = (rewards: ProviderRewards) => {
    const avgPerChurn = rewards.churnCount > 0 ? rewards.totalPaid.div(rewards.churnCount) : rewards.totalPaid

    const visibleChurns = new Set(
      [...new Set(rewards.payouts.map(({ churnHeight }) => churnHeight))]
        .sort((a, b) => b - a)
        .slice(0, PAYOUT_LIST_CHURNS)
    )
    const visiblePayouts = rewards.payouts.filter(({ churnHeight }) => visibleChurns.has(churnHeight))

    return (
      <div className="flex w-full flex-col">
        <div className="flex w-full flex-col gap-6 rounded-lg border border-solid border-gray0 bg-bg0 p-6 lg:flex-row lg:items-start lg:justify-between dark:border-gray0d dark:bg-bg0d">
          <div className="flex flex-col">
            <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
              {intl.formatMessage({ id: 'bonds.provider.rewards.title' })}
            </span>
            <div className="mt-2 flex items-center gap-3">
              <AssetIcon asset={AssetRuneNative} size="normal" network={network} />
              <span className="font-main-bold text-[44px] leading-none text-text0 dark:text-text0d">
                {isPrivate ? hiddenString : formatRuneAmount(rewards.totalPaid)}
              </span>
            </div>
            <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">
              {FP.pipe(
                formatPrice(rewards.totalPaid),
                O.map((price) => `≈ ${price} · `),
                O.getOrElse(() => '')
              )}
              {intl.formatMessage({ id: 'bonds.provider.rewards.churnCount' }, { count: rewards.churnCount })}
            </span>
          </div>
          <div className="flex flex-col items-start lg:items-end">
            <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
              {intl.formatMessage({ id: 'bonds.provider.rewards.avgPerChurn' })}
            </span>
            <div className="mt-2 flex items-center gap-2">
              <AssetIcon asset={AssetRuneNative} size="small" network={network} />
              <span className="font-main-bold text-[32px] leading-none text-text0 dark:text-text0d">
                {isPrivate ? hiddenString : formatRuneAmount(avgPerChurn)}
              </span>
            </div>
          </div>
        </div>

        {rewards.series.length > 0 && (
          <div className="mt-6 flex w-full flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
            <div className="h-[180px] w-full">
              <ChurnBars
                bars={rewards.series.map(({ amount, date }) => ({
                  value: baseToAsset(amount).amount().toNumber(),
                  label: `ᚱ${formatRuneAmount(amount)} · ${formatChurnDate(date, intl.locale)}`
                }))}
              />
            </div>
            <div className="mt-2 flex w-full justify-between">
              <span className="font-main text-[12px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
                {intl.formatMessage({ id: 'bonds.provider.detail.churnsAgo' }, { count: rewards.series.length })}
              </span>
              <span className="font-main text-[12px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
                {intl.formatMessage({ id: 'bonds.provider.detail.now' })}
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 flex w-full flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
          <div className="flex items-center justify-between">
            <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
              {intl.formatMessage({ id: 'bonds.provider.rewards.lastPayouts' })}
            </span>
            <BaseButton
              className="!p-0 font-main-semi-bold text-[12px] tracking-[1px] text-turquoise uppercase"
              onClick={() => exportCsv(rewards)}>
              {intl.formatMessage({ id: 'bonds.provider.rewards.exportCsv' })}
            </BaseButton>
          </div>
          <div className="mt-2 flex flex-col divide-y divide-gray0 dark:divide-gray0d">
            {visiblePayouts.map((payout, index) => (
              <div
                key={`${payout.nodeAddress}-${payout.churnHeight}-${index}`}
                className="flex items-center justify-between py-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
                    <span className="font-main-semi-bold text-[16px] text-text0 dark:text-text0d">
                      {isPrivate ? hiddenString : formatRuneAmount(payout.amount)}
                    </span>
                  </div>
                  <span className="mt-1 font-main text-[13px] text-gray2 dark:text-gray2d">
                    {truncateAddress(payout.nodeAddress, THORChain, network)}
                  </span>
                </div>
                <span className="font-main text-[14px] text-gray2 dark:text-gray2d">
                  {formatRelativeTime(payout.date, intl.locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderPerNode = (allNodes: NodeProviderRewards[]) => {
    const nodes = allNodes.filter(({ totalPaid }) => totalPaid.gt(0))

    return (
      <div className="flex w-full flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
        <div className="flex items-center justify-between">
          <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
            {intl.formatMessage({ id: 'bonds.provider.rewards.byNode' })}
          </span>
        </div>
        <div className="mt-2 flex flex-col divide-y divide-gray0 dark:divide-gray0d">
          {nodes.map((node) => (
            <div key={node.nodeAddress} className="flex items-center gap-6 py-5">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-main text-[16px] text-text0 dark:text-text0d">
                  {truncateAddress(node.nodeAddress, THORChain, network)}
                </span>
                <span className="mt-1 font-main text-[13px] text-gray2 dark:text-gray2d">
                  {node.churnsPaid > 0
                    ? intl.formatMessage({ id: 'bonds.provider.rewards.churnsPaid' }, { count: node.churnsPaid })
                    : intl.formatMessage({ id: 'bonds.provider.rewards.standby' })}
                </span>
              </div>
              <div className="hidden h-[48px] w-[180px] shrink-0 md:block">
                {node.series.length > 0 && (
                  <ChurnBars
                    bars={node.series.map(({ amount, date }) => ({
                      value: baseToAsset(amount).amount().toNumber(),
                      label: `ᚱ${formatRuneAmount(amount)} · ${formatChurnDate(date, intl.locale)}`
                    }))}
                  />
                )}
              </div>
              <div className="flex w-[120px] shrink-0 flex-col items-end">
                <span className="font-main-semi-bold text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
                  {intl.formatMessage({ id: 'bonds.provider.rewards.perChurn' })}
                </span>
                <div className="mt-1 flex items-center gap-1">
                  <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
                  <span className="font-main-semi-bold text-[15px] text-text0 dark:text-text0d">
                    {isPrivate
                      ? hiddenString
                      : FP.pipe(
                          node.lastPayout,
                          O.fold(
                            () => '0',
                            (amount) => formatRuneAmount(amount)
                          )
                        )}
                  </span>
                </div>
              </div>
              <div className="flex w-[140px] shrink-0 flex-col items-end">
                <span className="font-main-semi-bold text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d">
                  {intl.formatMessage({ id: 'bonds.provider.rewards.totalPaid' })}
                </span>
                <div className="mt-1 flex items-center gap-1">
                  <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
                  <span className="font-main-semi-bold text-[15px] text-text0 dark:text-text0d">
                    {isPrivate ? hiddenString : formatRuneAmount(node.totalPaid)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start">
      <div className="flex w-full items-center justify-between">
        <BaseButton className="group !p-0 font-main-semi-bold text-[14px] text-turquoise uppercase" onClick={goBack}>
          <ArrowLeftIcon className="mr-1 h-[16px] w-[16px] text-inherit transition-transform group-hover:-translate-x-[2px]" />
          {intl.formatMessage({ id: 'bonds.provider.detail.back' })}
        </BaseButton>
        <SegmentedTabs
          options={[
            { label: intl.formatMessage({ id: 'bonds.provider.rewards.allNodes' }), value: RewardsTab.AllNodes },
            { label: intl.formatMessage({ id: 'bonds.provider.rewards.perNode' }), value: RewardsTab.PerNode }
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      <div className="mt-8 w-full">
        {tab === RewardsTab.AllNodes
          ? FP.pipe(
              rewardsRD,
              RD.fold(
                () => <Spin className="m-auto" />,
                () => <Spin className="m-auto" />,
                renderUnavailable,
                renderAllNodes
              )
            )
          : FP.pipe(
              nodeRewardsRD,
              RD.fold(
                () => <Spin className="m-auto" />,
                () => <Spin className="m-auto" />,
                renderUnavailable,
                renderPerNode
              )
            )}
      </div>
    </div>
  )
}
