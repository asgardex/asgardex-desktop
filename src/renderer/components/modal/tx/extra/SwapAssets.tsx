import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { baseToAsset, formatAssetAmount } from '@xchainjs/xchain-util'

import { AssetData } from '../../../uielements/assets/assetData'
import { Label } from '../../../uielements/label'
import * as C from './Common.types'

export type Props = {
  source: C.AssetData
  target: C.AssetData
  stepDescription: string
  network: Network
}

export const SwapAssets = (props: Props): JSX.Element => {
  const { source, target, stepDescription, network } = props
  return (
    <div className="flex w-full flex-col items-center justify-center">
      <Label size="small" color="gray" className="w-full px-[10px] pt-[10px] pb-[15px] text-center font-main uppercase">
        {stepDescription}
      </Label>
      <div className="relative flex w-full flex-col items-center justify-center gap-1">
        <div className="flex w-full items-center justify-between px-10">
          <AssetData
            asset={source.asset}
            network={network}
            size="small"
            className="flex w-full items-center justify-start"
          />
          <Label className="text-3xl" align="right">
            {formatAssetAmount({ amount: baseToAsset(source.amount), trimZeros: true })}
          </Label>
        </div>
        <div className="flex items-center justify-center">
          <ArrowsRightLeftIcon className="h-8 w-8 rotate-90 text-gray-400" />
        </div>
        <div className="flex w-full items-center justify-between px-10">
          <AssetData
            asset={target.asset}
            network={network}
            size="small"
            className="flex w-full items-center justify-start"
          />
          <Label className="text-3xl" align="right">
            {formatAssetAmount({ amount: baseToAsset(target.amount), trimZeros: true })}
          </Label>
        </div>
      </div>
    </div>
  )
}
