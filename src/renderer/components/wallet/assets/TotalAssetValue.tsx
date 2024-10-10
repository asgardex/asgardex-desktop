import React, { useMemo, useState } from 'react'

import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import {
  BaseAmount,
  CryptoAmount,
  assetAmount,
  assetToBase,
  baseToAsset,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

import { AssetUSDC } from '../../../const'
import { hiddenString } from '../../../helpers/stringHelper'
import { BaseButton } from '../../uielements/button'
import { ChartColors } from '../../uielements/chart/utils'
import { InfoIcon } from '../../uielements/info'
import * as Styled from './TotalValue.styles'

type Props = {
  balancesByChain: Record<string, BaseAmount>
  errorsByChain: Record<string, string>
  title: string
  info?: string
  hidePrivateData: boolean
}

export const TotalAssetValue: React.FC<Props> = (props): JSX.Element => {
  const { balancesByChain, title, info, hidePrivateData, errorsByChain } = props
  // const intl = useIntl()

  const [showDetails, setShowDetails] = useState<boolean>(false)
  const chartData = useMemo(() => {
    return Object.entries(balancesByChain).map(([chain, balance], index) => ({
      name: `${chain.split(':')[0]}_${index}_${chain.split(':')[1]}`, // Add an index to make the key unique
      value: hidePrivateData ? 0 : baseToAsset(balance).amount().toNumber(),
      fillColor: ChartColors[index % ChartColors.length]
    }))
  }, [balancesByChain, hidePrivateData])

  const hasErrors = Object.keys(errorsByChain).length > 0
  // Map over the keys to create error messages.
  const chainErrors = useMemo(() => {
    // Map over the keys to create React elements for each error.
    const errorMessages = Object.keys(errorsByChain).map((chain) => (
      <div className="text-text2 hover:text-turquoise dark:text-text2d" key={chain}>{`${chain}: ${
        errorsByChain[chain].split('(')[0]
      }`}</div>
    ))

    return errorMessages // Return the array of React elements directly.
  }, [errorsByChain])

  const isChartVisible = useMemo(() => {
    const total = chartData.reduce((acc, { value }) => acc + value, 0)

    return total === 0 ? false : true
  }, [chartData])

  const totalBalanceDisplay = useMemo(() => {
    const total = chartData.reduce((acc, { value }) => acc + value, 0)
    const totalCyrpto = new CryptoAmount(assetToBase(assetAmount(total, 6)), AssetUSDC)
    const formattedTotal = hidePrivateData
      ? hiddenString
      : formatAssetAmountCurrency({
          asset: totalCyrpto.asset,
          amount: totalCyrpto.assetAmount,
          trimZeros: true,
          decimal: 0
        })
    return <div className="text-[28px] text-text2 hover:text-turquoise dark:text-text2d">{formattedTotal}</div>
  }, [chartData, hidePrivateData])
  const filteredChartData = chartData.filter((entry) => entry.value !== 0.0)

  return (
    <Styled.Container>
      <Styled.TitleContainer>
        <Styled.BalanceTitle>{title}</Styled.BalanceTitle>
        {info && <InfoIcon tooltip={info} color="primary" />}
      </Styled.TitleContainer>

      <BaseButton
        className="flex justify-between !p-0 font-mainSemiBold text-[16px] text-text2 hover:text-turquoise dark:text-text2d dark:hover:text-turquoise"
        onClick={() => setShowDetails((current) => !current)}>
        <div className="m-4">{totalBalanceDisplay}</div>
        {isChartVisible &&
          (showDetails ? (
            <MagnifyingGlassMinusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125" />
          ) : (
            <MagnifyingGlassPlusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125 " />
          ))}
      </BaseButton>
      {hasErrors && chainErrors}
      {isChartVisible && showDetails && (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={filteredChartData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={70}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              minAngle={15}
              label={({ name, value }) =>
                hidePrivateData
                  ? hiddenString
                  : `${name}: $${value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}`
              }>
              {filteredChartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fillColor} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}
    </Styled.Container>
  )
}
