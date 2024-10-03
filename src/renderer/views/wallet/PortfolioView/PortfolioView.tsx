import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { QueueListIcon, Squares2X2Icon, ChartPieIcon } from '@heroicons/react/24/outline'
import { assetAmount, assetToBase, baseToAsset, CryptoAmount, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

import { EnabledChain } from '../../../../shared/utils/chain'
import { RefreshButton } from '../../../components/uielements/button'
import { Table } from '../../../components/uielements/table'
import { AssetsNav } from '../../../components/wallet/assets'
import { AssetUSDC } from '../../../const'
import { hiddenString } from '../../../helpers/stringHelper'
import { usePrivateData } from '../../../hooks/usePrivateData'
import { useTotalWalletBalance } from '../../../hooks/useWalletBalance'
import { userChains$ } from '../../../services/storage/userChains'
import { reloadBalancesByChain } from '../../../services/wallet'
import * as Styled from './PortfolioView.style'

enum PortfolioTabKey {
  CardView,
  TableView,
  ChartView
}

const options = [
  { label: <Squares2X2Icon className="h-6 w-6 text-text2 dark:text-text2d" />, value: PortfolioTabKey.CardView },
  { label: <QueueListIcon className="h-6 w-6 text-text2 dark:text-text2d" />, value: PortfolioTabKey.TableView },
  { label: <ChartPieIcon className="h-6 w-6 text-text2 dark:text-text2d" />, value: PortfolioTabKey.ChartView }
]

const RadioGroup = ({
  options,
  activeIndex = 0,
  onChange
}: {
  options: { label: React.ReactNode; value: string | number }[]
  activeIndex?: number
  onChange: (index: number) => void
}) => {
  return (
    <div className="h-fit">
      <div className="flex rounded-lg border border-solid border-gray0 dark:border-gray0d">
        {options.map((option, index) => (
          <>
            {index !== 0 && <div className="h-10 w-[1px] bg-gray0 dark:bg-gray0d" />}
            <div
              key={option.value}
              className={clsx(
                'cursor-pointer p-2 hover:bg-gray0 hover:dark:bg-gray0d',
                'first:rounded-l-md last:rounded-r-md',
                activeIndex === index ? 'bg-gray0 dark:bg-gray0d' : 'bg-transparent'
              )}
              onClick={() => onChange(index)}>
              {option.label}
            </div>
          </>
        ))}
      </div>
    </div>
  )
}

const CardItem = ({ title, value }: { title: string; value: React.ReactNode }) => {
  return (
    <div className="rounded-lg border border-l-4 border-solid border-gray0 !border-l-turquoise py-2 px-4 dark:border-gray0d">
      <div className="flex w-full items-center justify-between">
        <div className="text-[13px] text-gray2 dark:text-gray2d">{title}</div>
        <div className="text-[13px] text-turquoise">Manage</div>
      </div>
      <div className="text-[20px] text-text2 dark:text-text2d">{value}</div>
    </div>
  )
}

const portfolioColumns = [
  { title: 'Section', dataIndex: 'section', key: 'section' },
  { title: 'Amount', dataIndex: 'amount', key: 'amount' },
  { title: 'Action', dataIndex: 'action', key: 'action' }
]

const portfolioDatasource = [
  { key: '1', section: 'Wallet', amount: '$5000', action: 'Manage' },
  { key: '1', section: 'LP Shares', amount: '$5000', action: 'Manage' },
  { key: '1', section: 'Savers', amount: '$5000', action: 'Manage' },
  { key: '1', section: 'Bonds', amount: '$5000', action: 'Manage' },
  { key: '1', section: 'Lending', amount: '$5000', action: 'Manage' },
  { key: '1', section: 'Total', amount: '$25000', action: 'Manage' }
]

export const PortfolioView: React.FC = (): JSX.Element => {
  const [activeIndex, setActiveIndex] = useState(PortfolioTabKey.CardView)
  const { isPrivate } = usePrivateData()

  const combinedBalances$ = useTotalWalletBalance()

  const [enabledChains, setEnabledChains] = useState<Set<EnabledChain>>(new Set())

  useEffect(() => {
    const subscription = userChains$.subscribe((chains: EnabledChain[]) => {
      setEnabledChains(new Set(chains))
    })

    return () => subscription.unsubscribe()
  }, [])

  const [{ balancesByChain }] = useObservableState(() => combinedBalances$, {
    chainBalances: [],
    balancesByChain: {},
    errorsByChain: {}
  })

  const totalBalanceDisplay = useMemo(() => {
    const chainValues = Object.entries(balancesByChain).map(([_, balance]) =>
      isPrivate ? 0 : baseToAsset(balance).amount().toNumber()
    )
    const total = chainValues.reduce((acc, value) => acc + value, 0)
    const totalCyrpto = new CryptoAmount(assetToBase(assetAmount(total, 6)), AssetUSDC)
    const formattedTotal = isPrivate
      ? hiddenString
      : formatAssetAmountCurrency({
          asset: totalCyrpto.asset,
          amount: totalCyrpto.assetAmount,
          trimZeros: true,
          decimal: 0
        })

    return formattedTotal
  }, [balancesByChain, isPrivate])

  const chartData = useMemo(() => {
    const COLORS = [
      '#0088FE', // Vivid Blue
      '#00C49F', // Aqua Green
      '#FFBB28', // Vibrant Yellow
      '#FF8042', // Bright Orange
      '#A569BD', // Purple
      '#F4D03F' // Sunflower Yellow
    ]

    const classNames = [
      'text-[#0088FE]',
      'text-[#00C49F]', // Aqua Green
      'text-[#FFBB28]', // Vibrant Yellow
      'text-[#FF8042]', // Bright Orange
      'text-[#A569BD]', // Purple
      'text-[#F4D03F]' // Sunflower Yellow
    ]
    // Define your color scheme
    return portfolioDatasource.map(({ section }, index) => ({
      name: section,
      value: 5000,
      fillColor: COLORS[index % COLORS.length],
      className: classNames[index % COLORS.length]
    }))
  }, [])

  const refreshHandler = useCallback(async () => {
    const delay = 1000
    const chains = Array.from(enabledChains || []) // Safeguard

    for (const [index, chain] of chains.entries()) {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
      const lazyReload = reloadBalancesByChain(chain)
      lazyReload()
    }
  }, [enabledChains])

  return (
    <>
      <div className="flex w-full justify-end pb-10px">
        <RefreshButton onClick={refreshHandler}></RefreshButton>
      </div>
      <AssetsNav />
      <div className="flex flex-col bg-bg1 p-4 dark:bg-bg1d">
        <div className="flex justify-end">
          <RadioGroup options={options} activeIndex={activeIndex} onChange={setActiveIndex} />
        </div>
        <div className="flex flex-col items-center justify-center">
          <Styled.Title size="big" className="text-gray2 dark:text-gray2d">
            Total Balance
          </Styled.Title>
          <div className="mb-4 !text-[28px] text-text2 dark:text-text2d">$1,000,000</div>
        </div>
        <div className="mt-4">
          {activeIndex === PortfolioTabKey.CardView && (
            <div className="grid grid-cols-3 gap-4">
              <CardItem title="Wallets" value={totalBalanceDisplay} />
              <CardItem title="LP Shares" value={totalBalanceDisplay} />
              <CardItem title="Savers" value={totalBalanceDisplay} />
              <CardItem title="Bonds" value={totalBalanceDisplay} />
              <CardItem title="Lending" value={totalBalanceDisplay} />
              <CardItem title="Staking" value={totalBalanceDisplay} />
            </div>
          )}
          {activeIndex === PortfolioTabKey.TableView && (
            <Table
              className="border border-solid border-gray0 dark:border-gray0d"
              columns={portfolioColumns}
              dataSource={portfolioDatasource}
            />
          )}
          {activeIndex === PortfolioTabKey.ChartView && (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="80%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    minAngle={15}
                    label={({ name }) => name}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fillColor} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col">
                {chartData.map((chartCol) => (
                  <div key={chartCol.name} className={chartCol.className}>
                    {chartCol.name} - {chartCol.value}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
