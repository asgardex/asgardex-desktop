import * as RD from '@devexperts/remote-data-ts'
import { Meta, StoryObj } from '@storybook/react'
import * as Rx from 'rxjs'

import { MOCK_KEYSTORE } from '../../../../shared/mock/wallet'
import { ImportKeystore as Component, Props } from './ImportKeystore'

const initialLoadKeystore = () => Rx.of(RD.initial)

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Wallet/ImportKeystore',
  argTypes: {
    loadKeystore$: {
      control: {
        type: 'select',
        options: ['initial', 'loading', 'error', 'success'],
        mapping: {
          initial: initialLoadKeystore,
          loading: () => Rx.of(RD.pending),
          error: () => Rx.of(RD.failure(new Error('load keystore error'))),
          success: () => Rx.of(RD.success(MOCK_KEYSTORE))
        }
      }
    },
    importingKeystoreState: {
      control: {
        type: 'select',
        options: ['initial', 'loading', 'error', 'success'],
        mapping: {
          initial: RD.initial,
          loading: RD.pending,
          error: RD.failure(new Error('import keystore error')),
          success: RD.success(true)
        }
      }
    },
    importKeystore: { action: 'importKeystore' }
  },
  args: {
    loadKeystore$: initialLoadKeystore,
    importingKeystoreState: RD.initial,
    clientStates: RD.success(true),
    walletId: new Date().getTime()
  },
  decorators: [
    (Story: React.FC) => (
      <div className="w-full bg-white">
        <Story />
      </div>
    )
  ]
}

// Define the default story using StoryObj
export const Default: StoryObj<Props> = {
  render: (args: Props) => <Component {...args} />,
  args: {
    // Default args as defined in your Meta
  }
}

export default meta
