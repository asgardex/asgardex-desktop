import { Meta } from '@storybook/react'

import { Modal as Component } from './Modal'

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Modal',
  argTypes: {
    children: {
      options: ['one', 'two', 'three'],
      mapping: {
        one: <p>Some contents...</p>,
        two: (
          <>
            <p>Some contents...</p>
            <p>Some contents...</p>
          </>
        ),
        three: (
          <>
            <p>Some contents...</p>
            <p>Some contents...</p>
            <p>Some contents...</p>
          </>
        )
      },
      defaultValue: 'one'
    },
    title: {
      control: {
        type: 'string'
      },
      defaultValue: 'Modal Title'
    }
  }
}

export default meta
