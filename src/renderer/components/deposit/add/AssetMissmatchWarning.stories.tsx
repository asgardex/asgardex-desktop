import { Meta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'

import { BSC_ADDRESS_MAINNET, RUNE_ADDRESS_TESTNET } from '../../../../shared/mock/address'
import { AssetBTC, AssetRuneNative } from '../../../../shared/utils/asset'
import * as AT from '../../../storybook/argTypes'
import { AssetWithAddress } from '../../../types/asgardex'
import { AssetMissmatchWarning as Component, Props } from './AssetMissmatchWarning'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />

export const Default = Template.bind({})

const btc: AssetWithAddress = { asset: AssetBTC, address: BSC_ADDRESS_MAINNET }
const rune: AssetWithAddress = { asset: AssetRuneNative, address: RUNE_ADDRESS_TESTNET }

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Deposit/AssetMissmatchWarning',
  argTypes: {
    network: AT.network
  },
  args: {
    assets: [btc, rune],
    network: Network.Mainnet
  }
}

export default meta
