import { Meta, StoryObj } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'

import { BSC_ADDRESS_MAINNET, BSC_ADDRESS_TESTNET } from '../../../../shared/mock/address'
import { AssetRuneNative } from '../../../../shared/utils/asset'
import * as AT from '../../../storybook/argTypes'
import { QRCodeModal as Component, Props } from './QRCodeModal'

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/QRCodeModal',
  argTypes: {
    network: AT.network,
    visible: { control: 'boolean' },
    onOk: { action: 'onOk' },
    onCancel: { action: 'onCancel' }
  },
  args: {
    network: Network.Mainnet,
    visible: true,
    onOk: () => {},
    onCancel: () => {}
  }
}

export default meta

// Define the default story using StoryObj model
export const Default: StoryObj<Props> = {
  render: (storyArgs: Props) => (
    <Component
      asset={AssetRuneNative}
      address={storyArgs.network === Network.Testnet ? BSC_ADDRESS_TESTNET : BSC_ADDRESS_MAINNET}
      network={storyArgs.network}
      visible={storyArgs.visible}
      onCancel={storyArgs.onCancel}
      onOk={storyArgs.onOk}
    />
  ),
  // Args setup directly within the StoryObj
  args: {
    network: Network.Mainnet,
    visible: true
  }
}
