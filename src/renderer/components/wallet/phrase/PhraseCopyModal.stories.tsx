import { Meta, StoryObj } from '@storybook/react'

import { MOCK_PHRASE } from '../../../../shared/mock/wallet'
import { PhraseCopyModal as Component, Props } from './PhraseCopyModal'

// Define the default story using StoryObj
export const Default: StoryObj<Props> = {
  render: (args: Props) => <Component {...args} />,
  args: {
    visible: true,
    phrase: MOCK_PHRASE
  }
}

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Wallet/PhraseCopyModal',
  argTypes: {
    phrase: {
      name: 'phrase',
      control: {
        type: 'text'
      }
    },
    onClose: { action: 'onClose' }
  }
}

export default meta
