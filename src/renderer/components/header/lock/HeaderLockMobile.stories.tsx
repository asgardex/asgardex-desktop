import { Meta, StoryFn } from '@storybook/react'
import * as O from 'fp-ts/lib/Option'

import * as AT from '../../../storybook/argTypes'
import { HeaderLockMobile as Component, Props } from './HeaderLockMobile'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />

export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/HeaderLockMobile',
  argTypes: {
    keystoreState: AT.keystore,
    onPress: { action: 'onPress' }
  },
  args: {
    keystoreState: O.none
  }
}

export default meta
