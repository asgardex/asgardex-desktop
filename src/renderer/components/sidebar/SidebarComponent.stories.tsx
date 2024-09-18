import { Meta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'

import * as AT from '../../storybook/argTypes'
import { SidebarComponent as Component, Props } from './SidebarComponent'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />

export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Sidebar',
  argTypes: {
    network: AT.network
  },
  args: {
    network: Network.Mainnet
  }
}

export default meta
