import { Meta, StoryObj } from '@storybook/react'

import { BaseButtonProps } from './BaseButton'
import baseMeta from './BaseButton.stories'
import { TextButton as Component } from './TextButton'

export type Props = BaseButtonProps & {
  color?: 'primary' | 'warning' | 'error' | 'neutral'
}

const meta: Meta<typeof Component> = {
  title: 'Components/button/TextButton',
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

// Define the default story using StoryObj model.
export const Default: StoryObj<Props> = {
  args: {
    ...baseMeta.args,
    color: 'primary' // Ensure this matches the Props type for color
  }
}
