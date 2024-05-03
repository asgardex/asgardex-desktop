import { Meta, StoryFn } from '@storybook/react'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'

import { AssetBSC } from '../../../../../shared/utils/asset'
import { AssetUSDCBSC } from '../../../../const'
import { AssetInput as Component, Props } from './AssetInput'

export const Default: StoryFn<Props> = (args) => <Component {...args} />

const amount = { amount: assetToBase(assetAmount(1.23, 8)), asset: AssetBSC }
const priceAmount = { amount: assetToBase(assetAmount(345, 8)), asset: AssetUSDCBSC }

const meta: Meta = {
  component: Component,
  title: 'Components/Assets/AssetInput',
  argTypes: {
    onChange: { action: 'onChange' },
    onBlur: { action: 'onBlur' },
    onFocus: { action: 'onFocus' },
    amount: {
      options: ['normal', 'decimal'],
      mapping: {
        normal: amount,
        decimal: assetToBase(assetAmount(321, 2))
      }
    }
  },
  args: {
    title: 'Swap amount',
    titleTooltip: 'Title Tooltip',
    amount,
    priceAmount,
    showError: false,
    disabled: false
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '20px' }}>
        <Story />
      </div>
    )
  ]
}

export default meta
