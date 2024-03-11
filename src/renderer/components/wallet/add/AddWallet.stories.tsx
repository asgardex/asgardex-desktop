import { Meta, StoryObj } from '@storybook/react'

import { AddWallet as Component, Props } from './AddWallet'

// Define the default story using StoryObj
export const Default: StoryObj<Props> = {
  render: (args: Props) => <Component {...args} />,
  args: {
    isLocked: false
  }
}

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Wallet/AddWallet',
  // Directly specify default args for all stories in this file
  args: {
    isLocked: false
  }
}

export default meta
