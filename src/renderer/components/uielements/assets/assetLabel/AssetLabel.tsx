import { AnyAsset } from '@xchainjs/xchain-util'

import clsx from 'clsx'
import { Label } from '../../label'

type Props = {
  asset: AnyAsset
  className?: string
}

export const AssetLabel = (props: Props) => {
  const { asset, className } = props

  return (
    <div className={clsx('py-1', className)}>
      <div>
        <Label className="!w-auto" size="big" textTransform="uppercase" weight="bold">
          {asset.ticker}
        </Label>
        <Label className="!w-auto" color="gray">
          {asset.chain}
        </Label>
      </div>
    </div>
  )
}
