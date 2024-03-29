import { Meta, StoryFn } from '@storybook/react'

import { ContentTitle as Component, Props } from './ContentTitle'

const Template: StoryFn<Props> = (args) => <Component {...args} />
export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/ContentTitle',
  args: {
    children: 'you are swapping'
  }
}

export default meta
