import { Network } from '@xchainjs/xchain-client'
import { Address, AnyAsset } from '@xchainjs/xchain-util'

import clsx from 'clsx'
import { AssetIcon, Size } from '../assetIcon'
import * as Styled from './AssetAddress.styles'

type Props = {
  asset: AnyAsset
  address: Address
  network: Network
  size?: Size
  className?: string
  classNameAddress?: string
}

export const AssetAddress = (props: Props) => {
  const { asset, address, network, size = 'normal', className = '', classNameAddress = '' } = props

  return (
    <div className={clsx('flex items-center', className)}>
      <AssetIcon asset={asset} size={size} network={network} />
      <div className="w-full overflow-hidden">
        <Styled.AddressEllipsis
          className={classNameAddress}
          address={address}
          iconSize={size}
          chain={asset.chain}
          network={network}
          enableCopy
        />
      </div>
    </div>
  )
}
