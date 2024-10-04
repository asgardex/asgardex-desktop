import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Squares2X2Icon, ChartPieIcon } from '@heroicons/react/24/outline'
import { assetAmount, assetToBase, baseToAsset, CryptoAmount, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

import { EnabledChain } from '../../../../shared/utils/chain'
import { RefreshButton } from '../../../components/uielements/button'
import { RadioGroup } from '../../../components/uielements/radioGroup'
import { Table } from '../../../components/uielements/table'
import { AssetUSDC } from '../../../const'
import { hiddenString } from '../../../helpers/stringHelper'
import { usePrivateData } from '../../../hooks/usePrivateData'
import { useTotalWalletBalance } from '../../../hooks/useWalletBalance'
import { userChains$ } from '../../../services/storage/userChains'
import { reloadBalancesByChain } from '../../../services/wallet'
import * as Styled from './PortfolioView.style'
import { Colors, ColorClassnames, PortfolioTabKey } from './utils'

const options = [
  { label: <ChartPieIcon className="h-6 w-6 text-text2 dark:text-text2d" />, value: PortfolioTabKey.ChartView },
  { label: <Squares2X2Icon className="h-6 w-6 text-text2 dark:text-text2d" />, value: PortfolioTabKey.CardView }
]

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
  const [activeIndex, setActiveIndex] = useState(PortfolioTabKey.ChartView)
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

  const chainChartData = useMemo(() => {
    // Define your color scheme
    return Object.entries(balancesByChain).map(([chain, balance], index) => ({
      name: `${chain.split(':')[0]}_${index}_${chain.split(':')[1]}`, // Add an index to make the key unique
      value: isPrivate ? 0 : baseToAsset(balance).amount().toNumber(),
      fillColor: Colors[index % Colors.length],
      className: ColorClassnames[index % Colors.length]
    }))
  }, [balancesByChain, isPrivate])

  const chartData = useMemo(() => {
    return portfolioDatasource.map(({ section }, index) => ({
      name: section,
      value: Math.floor(Math.random() * 5000),
      fillColor: Colors[index % Colors.length],
      className: ColorClassnames[index % Colors.length]
    }))
  }, [])

  const filteredChainData = useMemo(() => chainChartData.filter((entry) => entry.value !== 0.0), [chainChartData])

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
      <div className="flex flex-col rounded-lg bg-bg1 p-4 dark:bg-bg1d">
        <div className="flex justify-end">
          <RadioGroup options={options} activeIndex={activeIndex} onChange={setActiveIndex} />
        </div>
        <div className="flex flex-col items-center justify-center">
          <Styled.Title size="big" className="text-gray2 dark:text-gray2d">
            Total Balance
          </Styled.Title>
          <div className="mb-4 !text-[28px] text-text2 dark:text-text2d">$1,000,000</div>
        </div>
        <div className="mt-4 space-y-2">
          {activeIndex === PortfolioTabKey.CardView && (
            <div className="grid grid-cols-3 gap-4">
              <CardItem title="Wallets" value={totalBalanceDisplay} />
              <CardItem title="LP Shares" value={totalBalanceDisplay} />
              <CardItem title="Savers" value={totalBalanceDisplay} />
              <CardItem title="Bonds" value={totalBalanceDisplay} />
              <CardItem title="Lending" value={totalBalanceDisplay} />
              <CardItem title="Earning" value={totalBalanceDisplay} />
            </div>
          )}
          {activeIndex === PortfolioTabKey.ChartView && (
            <div className="flex flex-col">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-1 flex-col rounded-lg border border-solid border-gray0 p-4 dark:border-gray0d">
                  <Styled.Title size="large" className="text-gray2 dark:text-gray2d">
                    Allocation By Type
                  </Styled.Title>
                  <div className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={300}>
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
                  </div>
                  <div className="flex flex-wrap items-center justify-center space-x-4">
                    {chartData.map((chartCol) => (
                      <div key={chartCol.name} className={chartCol.className}>
                        {chartCol.name} - {chartCol.value}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-1 flex-col rounded-lg border border-solid border-gray0 p-4 dark:border-gray0d">
                  <Styled.Title size="large" className="text-gray2 dark:text-gray2d">
                    Allocation By Chain
                  </Styled.Title>
                  <div className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={filteredChainData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          innerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          minAngle={15}
                          label={({ name }) => name}>
                          {filteredChainData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fillColor} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap items-center justify-center space-x-4">
                    {filteredChainData.map((chartCol) => (
                      <div key={chartCol.name} className={chartCol.className}>
                        {chartCol.name} - {chartCol.value.toFixed(2)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <Table
            className="border border-solid border-gray0 dark:border-gray0d"
            columns={portfolioColumns}
            dataSource={portfolioDatasource}
          />
        </div>
      </div>
    </>
  )
}
