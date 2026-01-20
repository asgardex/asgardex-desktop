import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { baseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { array as A, function as FP, nonEmptyArray as NEA, option as O } from 'fp-ts'

import { isCacaoAsset } from '../../../helpers/assetHelper'
import { AssetIcon } from '../assets/assetIcon'
import { Fees } from '../fees'
import { ActionProps } from './types'

export const TxDetail = ({ className, outgos, incomes, fees = [], slip, network, isDesktopView }: ActionProps) => {
  const renderIncomes = useMemo(
    () =>
      FP.pipe(
        incomes,
        A.mapWithIndex((index, { asset, amount }) => (
          <div key={`in-${index}`} className="flex items-center">
            {isDesktopView && <AssetIcon className="mx-1" size="xsmall" asset={asset} network={network} />}
            <div className="whitespace-nowrap px-1 lg:px-0">
              {formatAssetAmountCurrency({
                trimZeros: true,
                amount: baseToAsset(
                  isCacaoAsset(asset) ? baseAmount(amount.amount().toNumber(), CACAO_DECIMAL) : amount
                ),
                asset
              })}
            </div>
          </div>
        ))
      ),
    [incomes, network, isDesktopView]
  )

  const renderOutgos = useMemo(
    () =>
      FP.pipe(
        outgos,
        A.mapWithIndex((index, { asset, amount }) => {
          return (
            <div key={`out-${index}`} className="flex items-center">
              {isDesktopView && <AssetIcon className="mx-1" size="xsmall" asset={asset} network={network} />}
              <div className="whitespace-nowrap px-1 lg:px-0">
                {formatAssetAmountCurrency({
                  trimZeros: true,
                  amount: baseToAsset(
                    isCacaoAsset(asset) ? baseAmount(amount.amount().toNumber(), CACAO_DECIMAL) : amount
                  ),
                  asset
                })}
              </div>
            </div>
          )
        })
      ),
    [outgos, network, isDesktopView]
  )

  const feesComponent = useMemo(
    () =>
      FP.pipe(
        fees,
        NEA.fromArray,
        O.map(RD.success),
        O.map((fees) => (
          <div key="fees" className="relative mr-0.5 inline-block first:ml-0 last:mr-0">
            <Fees fees={fees} />
          </div>
        )),
        O.getOrElse(() => <></>)
      ),
    [fees]
  )

  return (
    <div className={clsx('flex flex-col items-start', className)}>
      <div className="flex flex-wrap text-left last:mr-0 md:mr-4">
        <div
          className={clsx(
            'flex items-center px-5px py-[3px] text-xs uppercase leading-[22px]',
            'border border-gray2 bg-bg2 text-text0 dark:border-gray2d dark:bg-bg2d dark:text-text0d',
            'first:self-start first:rounded-l-[1.7rem] last:rounded-r-[1.7rem]',
            'md:px-10px md:py-5px md:text-sm'
          )}>
          <span className="mr-1 text-xs uppercase text-text2 first:ml-1 first:mr-1 last:ml-1 only:m-0 dark:text-text2d">
            in
          </span>
          {renderIncomes}
        </div>
        <div
          className={clsx(
            'flex items-center px-5px py-[3px] text-xs uppercase leading-[22px]',
            'border border-gray2 bg-bg2 text-text0 dark:border-gray2d dark:bg-bg2d dark:text-text0d',
            'first:self-start first:rounded-l-[1.7rem] last:rounded-r-[1.7rem]',
            'md:px-10px md:py-5px md:text-sm'
          )}>
          {renderOutgos}
          <span className="mr-1 text-xs uppercase text-text2 first:ml-1 first:mr-1 last:ml-1 only:m-0 dark:text-text2d">
            out
          </span>
        </div>
      </div>

      <span className="mr-10px p-0 text-sm text-gray2 last:mr-0 dark:text-gray2d">
        {feesComponent}
        {slip && <div className="relative mr-[2px] inline-block first:ml-0 last:mr-0">slip: {slip}%</div>}
      </span>
    </div>
  )
}
