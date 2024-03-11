import { Meta, StoryFn } from '@storybook/react'

import { HeaderSettings as Component, Props } from './HeaderSettings'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />
export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/HeaderSettings',
  argTypes: { onPress: { action: 'onPress' } },
  args: { isDesktopView: false }
}

export default meta
