import { Meta, StoryFn } from '@storybook/react'

import { StepBar as Component, Props } from './index'

export const Default: StoryFn<Props> = (args: Props) => <Component {...args} />

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/StepBar',
  decorators: [
    (Story: React.FC) => (
      <div style={{ padding: '20px' }}>
        <Story />
      </div>
    )
  ],
  args: {
    size: 100
  }
}

export default meta
