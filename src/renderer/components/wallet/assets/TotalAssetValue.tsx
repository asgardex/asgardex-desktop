import React, { useMemo, useState } from 'react'

import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
// import { useIntl } from 'react-intl'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

import { hiddenString } from '../../../helpers/stringHelper'
import { BaseButton } from '../../uielements/button'
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
    const COLORS = [
      '#0088FE', // Vivid Blue
      '#00C49F', // Aqua Green
      '#FFBB28', // Vibrant Yellow
      '#FF8042', // Bright Orange
      '#A569BD', // Purple
      '#F4D03F', // Sunflower Yellow
      '#5DADE2', // Light Blue
      '#48C9B0', // Medium Aquamarine
      '#EC7063', // Soft Red
      '#AF7AC5', // Lavender
      '#F7DC6F', // Light Goldenrod Yellow
      '#82E0AA', // Pastel Green
      '#F5B041', // Tangerine Yellow
      '#85C1E9', // Sky Blue
      '#D7DBDD', // Light Gray
      '#AED6F1', // Pale Blue
      '#A3E4D7', // Pale Aqua Green
      '#FAD7A0', // Peach Orange
      '#F5CBA7', // Light Brown
      '#CCD1D1' // Iron Gray
    ]
    // Define your color scheme
    return Object.entries(balancesByChain).map(([chain, balance], index) => ({
      name: `${chain.split(':')[0]}_${index}`, // Add an index to make the key unique
      value: hidePrivateData ? 0 : baseToAsset(balance).amount().toNumber(),
      fillColor: COLORS[index % COLORS.length]
    }))
  }, [balancesByChain, hidePrivateData])

  const hasErrors = Object.keys(errorsByChain).length > 0
  // Map over the keys to create error messages.
  const chainErrors = useMemo(() => {
    // Map over the keys to create React elements for each error.
    const errorMessages = Object.keys(errorsByChain).map((chain) => (
      <div key={chain}>{`${chain}: ${errorsByChain[chain].split('(')[0]}`}</div>
    ))

    return errorMessages // Return the array of React elements directly.
  }, [errorsByChain])

  const totalBalanceDisplay = useMemo(() => {
    const total = chartData.reduce((acc, { value }) => acc + value, 0)
    const formattedTotal = hidePrivateData ? hiddenString : total.toFixed(2)
    return <div className="text-[24px] text-text2 hover:text-turquoise dark:text-text2d">{`$ ${formattedTotal}`}</div>
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
        {showDetails ? (
          <MagnifyingGlassMinusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125" />
        ) : (
          <MagnifyingGlassPlusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125 " />
        )}
      </BaseButton>
      {hasErrors && chainErrors}
      {showDetails && (
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
