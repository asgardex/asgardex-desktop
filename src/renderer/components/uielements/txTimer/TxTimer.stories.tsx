import { Meta, StoryFn } from '@storybook/react'

import { TxTimer as Component, Props } from './TxTimer'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />
export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  title: 'Components/TxTimer',
  component: Component,
  argTypes: {
    startTime: {
      options: ['none', 'now'],
      mapping: {
        none: NaN,
        now: Date.now()
      }
    }
  },
  args: {
    status: true,
    interval: 1000,
    maxValue: 100
  }
}

export default meta
