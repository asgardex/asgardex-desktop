import { Meta, StoryObj } from '@storybook/react'

import { BorderButton, Props } from './BorderButton'

const meta: Meta<typeof BorderButton> = {
  title: 'Components/button/BorderButton',
  component: BorderButton,
  argTypes: {
    color: {
      control: 'select',
      options: ['primary', 'warning', 'error', 'neutral']
    },
    size: {
      control: 'select',
      options: ['small', 'normal', 'large']
    },
    transparent: {
      control: 'boolean'
    },
    disabled: {
      control: 'boolean'
    },
    className: {
      control: 'text'
    }
    // Assuming BaseButtonProps includes onClick or other event handlers, define them here if necessary
  },
  args: {
    color: 'primary',
    size: 'normal',
    transparent: false,
    disabled: false,
    className: '',
    children: 'Click Me' // Example default content
  }
}

export default meta

// Define the default story using StoryObj model
export const Default: StoryObj<Props> = {
  render: (args: Props) => <BorderButton {...args} />
  // Args here match the `Props` structure
}
