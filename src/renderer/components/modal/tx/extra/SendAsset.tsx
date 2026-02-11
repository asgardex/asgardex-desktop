import { Network } from '@xchainjs/xchain-client'

import { AssetData } from '../../../uielements/assets/assetData'
import { Label } from '../../../uielements/label'
import * as C from './Common.types'

type Props = {
  asset: C.AssetData
  description: string
  network: Network
}

export const SendAsset = (props: Props): JSX.Element => {
  const { asset, description = '', network } = props
  return (
    <div className="flex w-full flex-col items-center justify-center">
      <Label size="small" color="gray" className="w-full px-[10px] pt-[10px] pb-[15px] text-center uppercase">
        {description}
      </Label>
      <div className="relative flex items-center justify-center">
        <div className="flex flex-col px-5">
          <AssetData size="big" asset={asset.asset} amount={asset.amount} network={network} />
        </div>
      </div>
    </div>
  )
}
