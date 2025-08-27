import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Meta, StoryFn } from '@storybook/react'

import { Button } from '../button'
import { ButtonColor } from '../button/Button.types'
import { Alert as Component, Props } from './Alert'

const Template: StoryFn<Props> = (args) => <Component {...args} />
export const Default = Template.bind({})

const description = <div>This is a description message.</div>

const renderActionButton = (color: ButtonColor) => (
  <div>
    <p>{description}</p>
    <Button onClick={() => console.log('action')} typevalue="outline" color={color}>
      <ArrowPathIcon />
      Action Button
    </Button>
  </div>
)

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Alert',
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    )
  ],
  argTypes: {
    type: {
      name: 'type',
      control: {
        type: 'select',
        options: ['info', 'warning', 'error']
      }
    },
    title: {
      options: ['text', 'jsx'],
      mapping: {
        text: description,
        jsx: renderActionButton('primary')
      }
    }
  },
  args: {
    type: 'info',
    description
  }
}

export default meta
