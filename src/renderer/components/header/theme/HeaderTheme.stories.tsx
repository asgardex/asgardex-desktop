import { Meta, StoryFn } from '@storybook/react'

import { HeaderTheme as Component, Props } from './HeaderTheme'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />
export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/HeaderTheme',
  argTypes: {
    onPress: { action: 'onPress' }
  },
  args: {
    isDesktopView: false
  }
}

export default meta
