import { Meta, StoryObj } from '@storybook/react'

import { AppUpdate as Component, AppUpdateModalProps as Props } from './AppUpdate'

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/AppUpdate',
  argTypes: {
    goToUpdates: {
      action: 'goToUpdates'
    },
    close: {
      action: 'close'
    }
  },
  args: {
    isOpen: true,
    version: 'test version'
  }
}

export default meta

export const Default: StoryObj<Props> = {
  render: (args: Props) => <Component {...args} />
}
