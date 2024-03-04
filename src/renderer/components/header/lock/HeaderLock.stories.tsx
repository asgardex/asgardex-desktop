import { Meta, StoryFn } from '@storybook/react'
import * as O from 'fp-ts/lib/Option'

import * as AT from '../../../storybook/argTypes'
import { HeaderLock as Component, Props } from './HeaderLock'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />

export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/HeaderLock',
  argTypes: {
    keystoreState: AT.keystore,
    lockHandler: { action: 'onPress' }
  },
  args: {
    keystoreState: O.none
  }
}

export default meta
