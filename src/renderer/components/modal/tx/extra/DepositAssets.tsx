import { useMemo } from 'react'

import { ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'

import { AssetData } from '../../../uielements/assets/assetData'
import { Label } from '../../../uielements/label'
import * as C from './Common.types'

export type Props = {
  source: O.Option<C.AssetData>
  target: C.AssetData
  stepDescription: string
  network: Network
  isWithdraw?: boolean
}

export const DepositAssets = (props: Props): JSX.Element => {
  const { source: oSource, target, stepDescription, network, isWithdraw = false } = props

  const hasSource = useMemo(() => FP.pipe(oSource, O.isSome), [oSource])

  const renderSource = useMemo(
    () =>
      FP.pipe(
        oSource,
        O.map(({ asset, amount }) => (
          <AssetData
            key="source-data"
            asset={asset}
            amount={amount}
            network={network}
            size="big"
            className="flex w-full items-center justify-start"
          />
        )),
        O.getOrElse(() => <></>)
      ),
    [oSource, network]
  )

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <Label size="small" color="gray" className="w-full px-[10px] pt-[10px] pb-[15px] text-center uppercase">
        {stepDescription}
      </Label>
      <div className="relative flex flex-col items-center justify-center gap-5">
        {renderSource}
        {hasSource && (
          <div className="flex items-center justify-center p-2">
            {isWithdraw ? (
              <ArrowLeftIcon className="h-8 w-8 text-gray1 dark:text-gray1d" />
            ) : (
              <ArrowRightIcon className="h-8 w-8 text-gray1 dark:text-gray1d" />
            )}
          </div>
        )}
        <AssetData
          asset={target.asset}
          amount={target.amount}
          network={network}
          size="big"
          className="flex w-full items-center justify-start"
        />
      </div>
    </div>
  )
}

export type claimProps = {
  source: O.Option<C.AssetData>
  stepDescription: string
  network: Network
}

export const ClaimAsset = (props: claimProps): JSX.Element => {
  const { source: oSource, stepDescription, network } = props

  const renderSource = useMemo(
    () =>
      FP.pipe(
        oSource,
        O.map(({ asset, amount }) => (
          <AssetData key="source-data" className="mb-5 last:m-0" asset={asset} amount={amount} network={network} />
        )),
        O.getOrElse(() => <></>)
      ),
    [oSource, network]
  )

  return (
    <>
      <Label size="small" color="gray" className="w-full px-[10px] pt-[10px] pb-[15px] text-center uppercase">
        {stepDescription}
      </Label>
      <div className="relative flex items-center justify-center">
        <div className="flex flex-col px-5">{renderSource}</div>
      </div>
    </>
  )
}
