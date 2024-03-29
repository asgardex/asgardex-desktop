import { Meta, StoryFn } from '@storybook/react'

import { InputPassword as Component, PasswordProps } from './InputPassword'

const Template: StoryFn<PasswordProps> = (args) => <Component {...args} />
export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/InputPassword',
  argTypes: {
    onChange: {
      action: 'onChange'
    },
    onEnter: {
      action: 'onEnter'
    },
    onCancel: {
      action: 'onCancel'
    },
    size: {
      control: { type: 'select', options: ['small', 'normal', 'large'] }
    }
  },
  args: {
    placeholder: 'Placeholder',
    size: 'normal',
    error: '',
    disabled: false
  },
  decorators: [
    (Story) => (
      <div className="w-full bg-white p-20">
        <Story />
      </div>
    )
  ]
}

export default meta
