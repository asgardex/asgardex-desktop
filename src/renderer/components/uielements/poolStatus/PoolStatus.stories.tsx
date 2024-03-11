import { Meta, StoryObj } from '@storybook/react'
import { assetAmount, formatAssetAmountCurrency } from '@xchainjs/xchain-util'

import { PoolStatus as Component, Props } from './PoolStatus'

// Define the default story using StoryObj
export const Default: StoryObj<Props> = {
  render: (args: Props) => <Component {...args} />, // Define how the component is rendered using args
  args: {
    // Default args for your story
    label: 'Depth',
    displayValue: formatAssetAmountCurrency({ amount: assetAmount(12000), decimal: 0 }), // Assuming decimal parameter might be needed
    fullValue: formatAssetAmountCurrency({ amount: assetAmount(12000), decimal: 0 }), // Assuming decimal parameter might be needed
    isLoading: false
  }
}

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/PoolStatus',
  // args defined here apply to all stories in this file
  args: {
    label: 'Depth',
    displayValue: formatAssetAmountCurrency({ amount: assetAmount(12000), decimal: 0 }), // Default args for the component
    fullValue: formatAssetAmountCurrency({ amount: assetAmount(12000), decimal: 0 }),
    isLoading: false
  }
}

export default meta
