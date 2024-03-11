import { Meta, StoryObj } from '@storybook/react'

import baseMeta from './BaseButton.stories'
import { FlatButton as Component, Props } from './FlatButton'

const Flat: StoryObj<Props> = {
  render: (args: Props) => <Component {...args} />,
  args: {
    ...baseMeta.args, // Inheriting base args
    children: 'Flat Button', // Default children text
    color: 'primary' // Default color
  }
}

const meta: Meta<typeof Component> = {
  title: 'Components/button/FlatButton',
  component: Component,
  argTypes: {
    ...baseMeta.argTypes,
    color: {
      name: 'color',
      control: {
        type: 'select',
        options: ['primary', 'warning', 'error', 'neutral']
      }
    }
  }
}

export default meta

// Exporting Flat as the default story for FlatButton
export const Default = Flat
