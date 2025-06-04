import React, { useMemo, useCallback } from 'react'

import { AnyAsset, assetFromString, assetToString } from '@xchainjs/xchain-util'
import { Row, Dropdown } from 'antd'
import { MenuProps } from 'antd/lib/menu'
import { ItemType } from 'antd/lib/menu/hooks/useItems'
import { array as A, function as FP, option as O } from 'fp-ts'

import { SelectedPricePoolAsset } from '../../../services/midgard/midgardTypes'
import { PricePoolAsset, PricePoolAssets } from '../../../views/pools/Pools.types'
import { DownIcon } from '../../icons'
import { Menu } from '../../shared/menu/Menu'
import { toHeaderCurrencyLabel } from '../Header.util'
import { HeaderDropdownContentWrapper, HeaderDropdownMenuItemText, HeaderDropdownTitle } from '../HeaderMenu.styles'
import * as Styled from './HeaderPriceSelector.styles'

export type Props = {
  isDesktopView: boolean
  assets: PricePoolAssets
  disabled?: boolean
  selectedAsset: SelectedPricePoolAsset
  changeHandler?: (asset: PricePoolAsset) => void
}

export const HeaderPriceSelector = (props: Props): JSX.Element => {
  const { assets, selectedAsset, isDesktopView, disabled = false, changeHandler = (_) => {} } = props

  const changeItem: MenuProps['onClick'] = useCallback(
    ({ key }: { key: string }) => FP.pipe(key, assetFromString, O.fromNullable, O.map(changeHandler)),
    [changeHandler]
  )

  const menu = useMemo(
    () => (
      <Menu
        onClick={changeItem}
        items={FP.pipe(
          assets,
          A.map<AnyAsset, ItemType>((asset) => ({
            label: (
              <HeaderDropdownMenuItemText strong className="px-10px py-[8px]">
                {toHeaderCurrencyLabel(asset)}
              </HeaderDropdownMenuItemText>
            ),
            key: assetToString(asset)
          }))
        )}
      />
    ),
    [changeItem, assets]
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
    <Styled.Wrapper>
      <Dropdown disabled={disabled} overlay={menu} trigger={['click']} placement="bottom">
        <HeaderDropdownContentWrapper>
          {!isDesktopView && <HeaderDropdownTitle>Currency</HeaderDropdownTitle>}
          <Row style={{ alignItems: 'center' }}>
            <HeaderDropdownMenuItemText strong>{title}</HeaderDropdownMenuItemText>
            <DownIcon />
          </Row>
        </HeaderDropdownContentWrapper>
      </Dropdown>
    </Styled.Wrapper>
  )
}
