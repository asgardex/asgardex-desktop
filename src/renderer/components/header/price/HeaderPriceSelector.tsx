import { useMemo } from 'react'

import { array as A, function as FP, option as O } from 'fp-ts'

import { SelectedPricePoolAsset } from '../../../services/midgard/midgardTypes'
import { PricePoolAsset, PricePoolAssets } from '../../../views/pools/Pools.types'
import { DownIcon } from '../../icons'
import { Dropdown } from '../../uielements/dropdown'
import { Label } from '../../uielements/label'
import { toHeaderCurrencyLabel } from '../Header.util'

export type Props = {
  isDesktopView: boolean
  assets: PricePoolAssets
  disabled?: boolean
  selectedAsset: SelectedPricePoolAsset
  changeHandler?: (asset: PricePoolAsset) => void
}

export const HeaderPriceSelector = (props: Props): JSX.Element => {
  const { assets, selectedAsset, isDesktopView, changeHandler = (_) => {} } = props

  const menu = useMemo(
    () =>
      FP.pipe(
        assets,
        A.map((asset) => (
          <div key={asset.symbol} className="px-2 py-1" onClick={() => changeHandler(asset)}>
            <Label size="big" color="dark" textTransform="uppercase" weight="bold">
              {toHeaderCurrencyLabel(asset)}
            </Label>
          </div>
        ))
      ),
    [assets, changeHandler]
  )

  const title = useMemo(
    () =>
      FP.pipe(
        selectedAsset,
        O.fold(() => '--', toHeaderCurrencyLabel)
      ),
    [selectedAsset]
  )

  return (
    <div className="flex items-center justify-between w-full px-6 lg:w-auto lg:px-0">
      {!isDesktopView && (
        <Label size="large" textTransform="uppercase" weight="bold">
          Currency
        </Label>
      )}
      <Dropdown
        anchor={{ to: 'bottom', gap: 4 }}
        trigger={
          <div className="min-w-24 lg:min-w-0 flex items-center cursor-pointer">
            <Label className="!text-16" color="dark" weight="bold" textTransform="uppercase">
              {title}
            </Label>
            <DownIcon />
          </div>
        }
        options={menu}
      />
    </div>
  )
}
