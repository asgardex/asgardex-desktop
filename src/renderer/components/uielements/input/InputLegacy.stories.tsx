import { Meta } from '@storybook/react'

import { Input as Component, InputPassword, InputTextArea } from './Input.styles'

const defaultInput: Meta<typeof InputPassword> = {
  component: InputPassword,
  title: 'Components/InputLegacy',
  decorators: [
    (Story) => (
      <div style={{ padding: '15px' }}>
        <Story />
      </div>
    )
  ],
  argTypes: {
    typevalue: {
      control: {
        type: 'select',
        options: ['normal', 'ghost']
      }
    },
    color: {
      control: {
        type: 'select',
        options: ['primary', 'success', 'warning', 'error']
      }
    },
    size: {
      control: {
        type: 'select',
        options: ['small', 'middle', 'large']
      }
    }
  },
  args: {
    value: 'Input Text',
    typevalue: 'normal',
    color: 'primary',
    size: 'middle'
  }
}

export default defaultInput

export const pwInput: Meta<typeof Component> = {
  component: InputPassword,
  title: 'Components/InputPassword',
  argTypes: { ...defaultInput.argTypes }
}

export const textAreaInput: Meta<typeof Component> = {
  component: InputTextArea,
  title: 'Components/InputTextArea',
  argTypes: { ...defaultInput.argTypes }
}
