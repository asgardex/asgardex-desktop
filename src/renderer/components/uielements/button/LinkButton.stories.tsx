import { Meta, StoryObj } from '@storybook/react'

import baseMeta from './BaseButton.stories'
import { LinkButton as Component, Props } from './LinkButton'

const meta: Meta<typeof Component> = {
  title: 'Components/button/LinkButton',
  component: Component,
  argTypes: {
    ...baseMeta.argTypes,
    color: {
      control: {
        type: 'select',
        options: ['primary', 'warning', 'error', 'neutral']
      }
    },
    size: {
      control: {
        type: 'select',
        options: ['small', 'medium', 'normal', 'large']
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
