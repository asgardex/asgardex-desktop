import * as RD from '@devexperts/remote-data-ts'
import { Meta, StoryObj } from '@storybook/react'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import * as AT from '../../../storybook/argTypes'
import { UnlockForm as Component, Props } from './UnlockForm'

// Define the default story using StoryObj
export const Default: StoryObj<Props> = {
  render: (args: Props) => <Component {...args} />,
  args: {
    keystore: O.none,
    unlock: (pw: string) => {
      console.log('unlock:', pw)
      return Promise.resolve()
    },
    removeKeystore: () => {
      console.log('removeKeystore')
      return Promise.resolve(1)
    },
    wallets: [
      { id: 0, name: 'wallet 0', selected: false },
      { id: 1, name: 'wallet 1', selected: false },
      { id: 2, name: 'wallet 2', selected: true },
      { id: 3, name: 'wallet 3', selected: false }
    ],
    changeKeystore$: (_: unknown) => Rx.of(RD.initial)
  }
}

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Wallet/UnlockForm',
  argTypes: {
    keystore: AT.keystore
  },
  decorators: [
    (Story: React.FC) => (
      <div className="h-full w-full bg-bg2 p-20">
        <Story />
      </div>
    )
  ]
}

export default meta
