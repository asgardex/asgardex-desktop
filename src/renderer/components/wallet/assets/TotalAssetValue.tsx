import { useMemo, useState } from 'react'

import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import {
  BaseAmount,
  CryptoAmount,
  assetAmount,
  assetToBase,
  baseToAsset,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'

import { AssetUSDC } from '../../../const'
import { hiddenString } from '../../../helpers/stringHelper'
import { BaseButton } from '../../uielements/button'
import { PieChart } from '../../uielements/charts'
import { InfoIcon } from '../../uielements/info'
import { Label } from '../../uielements/label'

type Props = {
  balancesByChain: Record<string, BaseAmount>
  errorsByChain: Record<string, string>
  title: string
  info?: string
  hidePrivateData: boolean
}

export const TotalAssetValue = (props: Props): JSX.Element => {
  const { balancesByChain, title, info, hidePrivateData, errorsByChain } = props
  const [showDetails, setShowDetails] = useState<boolean>(false)
  const chartData = useMemo(
    () =>
      Object.entries(balancesByChain).map(([chain, balance]) => {
        const value = parseFloat(baseToAsset(balance).amount().toFixed(2))
        return {
          name: `${chain.split(':')[0]} ${chain.split(':')[1] ?? ''}`, // Add an index to make the key unique
          value: hidePrivateData ? 0 : parseFloat(value.toFixed(value < 1 ? 2 : 0))
        }
      }),
    [balancesByChain, hidePrivateData]
  )

  const hasErrors = Object.keys(errorsByChain).length > 0
  // Map over the keys to create error messages.
  const chainErrors = useMemo(() => {
    // Map over the keys to create React elements for each error.
    const errorMessages = Object.keys(errorsByChain).map((chain) => (
      <div className="text-text2 hover:text-turquoise dark:text-text2d" key={chain}>
        {`${chain}: ${errorsByChain[chain].split('(')[0]}`}
      </div>
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
    <div className="flex flex-col items-center justify-center px-4 pt-4 pb-8 bg-bg1 dark:bg-bg1d">
      <div className="flex items-center">
        <Label className="!w-auto" align="center" color="input" textTransform="uppercase">
          {title}
        </Label>
        {info && <InfoIcon tooltip={info} color="primary" />}
      </div>

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
      {isChartVisible && showDetails && <PieChart chartData={filteredChartData} isLegendHidden showLabelLine />}
    </div>
  )
}
