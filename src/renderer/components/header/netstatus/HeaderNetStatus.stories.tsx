import * as RD from '@devexperts/remote-data-ts'
import { Meta, StoryFn } from '@storybook/react'

import { HeaderNetStatus as Component, Props } from './HeaderNetStatus'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />

export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/HeaderNetStatus',
  args: {
    midgardStatus: RD.initial,
    mimirStatus: RD.initial,
    midgardUrl: RD.success('midgard-url'),
    thorchainNodeUrl: 'thorchain-node-url',
    thorchainRpcUrl: 'thorchain-rpc-url',
    isDesktopView: false
  }
}

export default meta
