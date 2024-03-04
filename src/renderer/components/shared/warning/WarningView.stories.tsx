import { SyncOutlined } from '@ant-design/icons'
import { Meta, StoryObj } from '@storybook/react'

import { Button } from '../../uielements/button'
import { WarningView as Component, Props } from './WarningView'

// Define the action button directly within the component or story,
// if it needs to be dynamically added based on story args.
const ActionButton = () => (
  <Button onClick={() => console.log('action')} typevalue="outline">
    <SyncOutlined />
    Action Button
  </Button>
)

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/WarningView',
  // Removing `mapping` since dynamic JSX cannot be directly achieved this way
  argTypes: {
    extra: {
      options: ['none', 'extra'],
      control: { type: 'select' }
    }
  },
  args: {
    title: 'Warning message!',
    extra: 'none' // Use 'none' to indicate no extra content by default
  }
}

export const Default: StoryObj<Props> = {
  render: (args: Props) => <Component {...args} extra={args.extra === 'extra' ? <ActionButton /> : null} />,
  args: {
    title: 'Warning message!',
    extra: 'none' // Reflecting the control to toggle the action button
  }
}

export default meta
