import { Meta, StoryFn } from '@storybook/react'
import * as O from 'fp-ts/lib/Option'

import { AssetBTC, AssetETH, AssetRuneNative } from '../../../../shared/utils/asset'
import { AssetUSDC } from '../../../const'
import { HeaderPriceSelector as Component, Props } from './HeaderPriceSelector'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />

export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/HeaderPriceSelector',
  argTypes: {
    changeHandler: { action: 'changeHandler' },
    selectedAsset: {
      options: ['RUNE', 'BTC', 'ETH', 'USD'],
      mapping: {
        RUNE: O.some(AssetRuneNative),
        BTC: O.some(AssetBTC),
        ETH: O.some(AssetETH),
        USD: O.some(AssetUSDC)
      }
    }
  },
  args: {
    assets: [AssetRuneNative, AssetBTC, AssetETH, AssetUSDC],
    selectedAsset: O.some(AssetUSDC),
    isDesktopView: false,
    disabled: false
  }
}

export default meta
