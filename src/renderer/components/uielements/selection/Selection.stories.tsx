import { Meta, StoryFn } from '@storybook/react'

import { Selection as Component, Props } from './Selection'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />
export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Selection',
  argTypes: {
    onSelect: {
      action: 'onSelect'
    }
  },
  args: {
    selected: 0
  }
}

export default meta
