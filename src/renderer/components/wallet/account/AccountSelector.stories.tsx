import { Meta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'

import { AssetBSC } from '../../../../shared/utils/asset'
import { mockWalletBalance } from '../../../helpers/test/testWalletHelper'
import { AccountSelector as Component, Props } from './AccountSelector'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />

export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Deposit/PendingAssets',
  argTypes: {},
  args: {
    network: Network.Testnet,
    selectedWallet: mockWalletBalance({
      asset: AssetBSC,
      walletAddress: 'bnb-ledger-address'
    })
  }
}

export default meta
