import * as RD from '@devexperts/remote-data-ts'
import { Meta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import * as Rx from 'rxjs'

import { ThorchainProvider } from '../../contexts/ThorchainContext'
import { TrackedTransaction, TransactionTrackingService } from '../../services/thorchain/transactionTracking'
import * as AT from '../../storybook/argTypes'
import { SidebarComponent as Component, Props } from './SidebarComponent'

// Mock transaction tracking service for stories
const createMockTransactionTrackingService = (): TransactionTrackingService => {
  const mockTransactions: TrackedTransaction[] = [
    {
      id: 'tx_1',
      txHash: '0x1234567890abcdef1234567890abcdef12345678',
      startTime: Date.now() - 120000, // 2 minutes ago
      fromAsset: 'BTC.BTC',
      toAsset: 'THOR.RUNE',
      amount: '0.5',
      stages: {
        inboundObserved: { completed: true, finalCount: 1 },
        inboundConfirmationCounted: { completed: true, remainingConfirmationSeconds: 0 },
        inboundFinalised: { completed: true },
        swapStatus: {
          pending: false,
          streaming: {
            interval: 1,
            quantity: 3,
            count: 2
          }
        },
        swapFinalised: false,
        outboundSigned: {
          completed: false,
          scheduledOutboundHeight: undefined,
          blocksSinceScheduled: undefined
        },
        outBoundDelay: {
          remainDelaySeconds: 45,
          remainingDelayBlocks: 5,
          completed: false
        }
      },
      isComplete: false
    },
    {
      id: 'tx_2',
      txHash: 'abcdef1234567890abcdef1234567890abcdef12',
      startTime: Date.now() - 300000, // 5 minutes ago
      fromAsset: 'ETH.ETH',
      toAsset: 'BTC.BTC',
      amount: '1.2',
      stages: {
        inboundObserved: { completed: true, finalCount: 1 },
        inboundConfirmationCounted: { completed: true, remainingConfirmationSeconds: 0 },
        inboundFinalised: { completed: true },
        swapStatus: {
          pending: false,
          streaming: {
            interval: 1,
            quantity: 1,
            count: 1
          }
        },
        swapFinalised: true,
        outboundSigned: {
          completed: true,
          scheduledOutboundHeight: undefined,
          blocksSinceScheduled: undefined
        },
        outBoundDelay: {
          remainDelaySeconds: 0,
          remainingDelayBlocks: 0,
          completed: true
        }
      },
      isComplete: true,
      completedAt: Date.now() - 60000 // Completed 1 minute ago
    }
  ]

  return {
    addTransaction: () => {},
    removeTransaction: () => {},
    getTransactions$: Rx.of(RD.success(mockTransactions)),
    reloadTransactions: () => {}
  }
}

// Mock transaction tracking service
const mockTransactionTrackingService = createMockTransactionTrackingService()

const Template: StoryFn<Props> = (args: Props) => {
  return (
    <ThorchainProvider>
      <Component {...args} />
    </ThorchainProvider>
  )
}

export const Default = Template.bind({})

export const WithActiveTransactions = Template.bind({})
WithActiveTransactions.args = {
  network: Network.Mainnet,
  isDev: false,
  publicIP: '127.0.0.1'
}

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Sidebar',
  argTypes: {
    network: AT.network
  },
  args: {
    network: Network.Mainnet,
    isDev: false,
    publicIP: '127.0.0.1'
  },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', width: '320px', background: '#f5f5f5' }}>
        <Story />
      </div>
    )
  ],
  parameters: {
    // Mock the module to provide our transaction tracking service
    mockData: {
      transactionTrackingService: mockTransactionTrackingService
    }
  }
}

export default meta
