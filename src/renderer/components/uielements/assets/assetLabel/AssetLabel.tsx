import { AnyAsset } from '@xchainjs/xchain-util'

import clsx from 'clsx'
import { distinctChainId } from '../../../../helpers/assetHelper'
import { Label } from '../../label'

type Props = {
  asset: AnyAsset
  className?: string
}

export const AssetLabel = (props: Props) => {
  const { asset, className } = props
  const chainId = distinctChainId(asset)

  return (
    <div className={clsx('py-1', className)}>
      <div>
        <Label className="!w-auto" size="big" textTransform="uppercase" weight="bold">
          {asset.ticker}
        </Label>
        {chainId && (
          <Label className="!w-auto" color="gray">
            {chainId}
          </Label>
        )}
      </div>
    </div>
  )
}
