import { Meta, StoryFn } from '@storybook/react'
import * as O from 'fp-ts/lib/Option'

import { AssetBTC, AssetETH, AssetRuneNative } from '../../../../shared/utils/asset'
import { AssetBUSDBAF } from '../../../const'
import { HeaderPriceSelector as Component, Props } from './HeaderPriceSelector'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />

export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/HeaderPriceSelector',
  argTypes: {
    changeHandler: { action: 'changeHandler' },
    selectedAsset: {
      options: ['RUNE', 'BTC', 'ETH', 'BUSD'],
      mapping: {
        RUNE: O.some(AssetRuneNative),
        BTC: O.some(AssetBTC),
        ETH: O.some(AssetETH),
        BUSD: O.some(AssetBUSDBAF)
      }
    }
  },
  args: {
    assets: [AssetRuneNative, AssetBTC, AssetETH, AssetBUSDBAF],
    selectedAsset: O.some(AssetBUSDBAF),
    isDesktopView: false,
    disabled: false
  }
}

export default meta
