import { Meta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'

import { BNB_ADDRESS_TESTNET, RUNE_ADDRESS_TESTNET } from '../../../../shared/mock/address'
import { AssetBNB, AssetRuneNative } from '../../../../shared/utils/asset'
import * as AT from '../../../storybook/argTypes'
import { AssetWithAddress } from '../../../types/asgardex'
import { AssetMissmatchWarning as Component, Props } from './AssetMissmatchWarning'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />

export const Default = Template.bind({})

const bnb: AssetWithAddress = { asset: AssetBNB, address: BNB_ADDRESS_TESTNET }
const rune: AssetWithAddress = { asset: AssetRuneNative, address: RUNE_ADDRESS_TESTNET }

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Deposit/AssetMissmatchWarning',
  argTypes: {
    network: AT.network
  },
  args: {
    assets: [bnb, rune],
    network: Network.Mainnet
  }
}

export default meta
