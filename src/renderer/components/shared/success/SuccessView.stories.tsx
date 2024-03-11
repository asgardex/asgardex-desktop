import { Meta, StoryObj } from '@storybook/react'

import { Button } from '../../uielements/button'
import { SuccessView as Component, Props } from './SuccessView'

const renderActionButton = () => (
  <Button onClick={() => console.log('action')} typevalue="outline">
    Click me
  </Button>
)

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/SuccessView',
  argTypes: {
    extra: {
      options: ['null', 'extra'],
      mapping: {
        null: null,
        extra: renderActionButton()
      }
    }
  },
  args: {
    title: 'Data loaded successfully!',
    extra: null
  }
}

// Define the default story using StoryObj
export const Default: StoryObj<Props> = {
  render: (args: Props) => <Component {...args} />,
  args: {
    title: 'Data loaded successfully!'
  }
}

export default meta
