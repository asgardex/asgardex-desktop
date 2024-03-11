import { Meta, StoryObj } from '@storybook/react'

import { Radio, RadioLabel } from './Radio.styles'

// Define the type for the story's args
type Args = {
  disabled: boolean
}

const meta: Meta<typeof Radio> = {
  title: 'Components/shared/Radio',
  component: Radio,
  args: {
    disabled: false
  }
}

export default meta

// Define the default story using StoryObj model
export const Default: StoryObj<Args> = {
  render: (args: Args) => (
    <Radio.Group defaultValue="1" disabled={args.disabled}>
      <Radio value="1">
        <RadioLabel disabled={args.disabled}>One</RadioLabel>
      </Radio>
      <Radio value="2">
        <RadioLabel disabled={args.disabled}>Two</RadioLabel>
      </Radio>
    </Radio.Group>
  )
}
