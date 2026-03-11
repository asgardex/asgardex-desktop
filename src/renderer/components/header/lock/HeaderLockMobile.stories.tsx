import { Meta, StoryFn } from '@storybook/react'
import { none as O_none } from 'fp-ts/lib/Option'

import { HeaderLockMobile as Component, Props } from './HeaderLockMobile'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />

export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/HeaderLockMobile',
  argTypes: {
    hasWallet: { control: 'boolean' },
    isLocked: { control: 'boolean' },
    onPress: { action: 'onPress' }
  },
  args: {
    hasWallet: true,
    isLocked: false,
    activeWallet: O_none
  }
}

export default meta
