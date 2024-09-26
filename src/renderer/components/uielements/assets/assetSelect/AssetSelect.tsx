import React, { useCallback, useState } from 'react'

import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset } from '@xchainjs/xchain-util'

import { emptyString } from '../../../../helpers/stringHelper'
import { BaseButton } from '../../button'
import { AssetData } from '../assetData'
import { AssetMenu } from '../assetMenu'

export type Props = {
  asset: AnyAsset
  assets: AnyAsset[]
  onSelect: (_: AnyAsset) => void
  className?: string
  showAssetName?: boolean
  dialogHeadline?: string
  shadowless?: boolean
  disabled?: boolean
  network: Network
}

export const AssetSelect: React.FC<Props> = (props): JSX.Element => {
  const {
    asset,
    assets = [],
    onSelect = (_: AnyAsset) => {},
    className = '',
    dialogHeadline = emptyString,
    showAssetName = true,
    disabled = false,
    shadowless = false,
    network
  } = props

  const [openMenu, setOpenMenu] = useState<boolean>(false)

  const buttonClickHandler = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenu(true)
  }, [])

  const handleChangeAsset = useCallback(
    async (asset: AnyAsset) => {
      onSelect(asset)
      setOpenMenu(false)
    },
    [onSelect]
  )

  const disableButton = disabled || !assets.length

  return (
    <div>
      <AssetMenu
        asset={asset}
        assets={assets}
        onSelect={handleChangeAsset}
        open={openMenu}
        onClose={() => setOpenMenu(false)}
        headline={dialogHeadline}
        network={network}
      />
      <BaseButton
        className={`group px-10px py-[2px] ${
          !disableButton && !shadowless ? 'hover:shadow-full hover:dark:shadow-fulld' : ''
        }
        focus:outline-none ${className}`}
        disabled={disableButton}
        onClick={buttonClickHandler}>
        <AssetData noTicker={!showAssetName} className="" asset={asset} network={network} />

        <ChevronDownIcon
          className={`ease h-20px w-20px text-turquoise ${openMenu ? 'rotate-180' : 'rotate-0'}
            ${!disableButton ? 'group-hover:rotate-180' : ''}
            `}
        />
      </BaseButton>
    </div>
  )
}
