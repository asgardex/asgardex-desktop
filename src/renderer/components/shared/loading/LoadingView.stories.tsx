import { Meta, StoryObj } from '@storybook/react'

import { LoadingView as Component, Props } from './LoadingView'

// Define the default story using StoryObj
export const Default: StoryObj<Props> = {
  render: (args: Props) => <Component {...args} />,
  args: {
    label: 'Loading data!' // Default args for this story
  }
}

// Define meta for Storybook
const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/LoadingView'
}

export default meta
