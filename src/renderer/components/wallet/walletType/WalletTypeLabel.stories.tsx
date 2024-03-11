import { Meta, StoryObj } from '@storybook/react'

import { WalletTypeLabel as Component, Props } from './WalletTypeLabel'

// Define the default story using StoryObj
export const Default: StoryObj<Props> = {
  render: (args: Props) => <Component {...args} />, // Use render method to return your component with args
  args: {
    children: 'keystore' // Default args
  }
}

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/WalletTypeLabel',
  argTypes: {
    children: {
      name: 'wallet type',
      options: ['keystore', 'ledger'],
      control: { type: 'select' } // Specify control type for Storybook UI
    }
  },
  decorators: [
    (Story: React.FC) => (
      <div style={{ display: 'flex', alignItems: 'center', padding: '20px', backgroundColor: '#fff' }}>
        <Story />
      </div>
    )
  ]
}

export default meta
