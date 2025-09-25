import { Meta, StoryFn } from '@storybook/react'

import { Pagination as Component } from './index'
import type { Props } from './Pagination'

const Template: StoryFn<Props> = (args) => <Component {...args} />
export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Pagination',
  argTypes: {
    onChange: { action: 'onChange' }
  },
  args: {
    defaultCurrent: 1,
    total: 100,
    defaultPageSize: 5
  }
}

export default meta
