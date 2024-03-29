import { Meta } from '@storybook/react'
import { BNBChain } from '@xchainjs/xchain-binance'
import { Network } from '@xchainjs/xchain-client'

import { BNB_ADDRESS_MAINNET, BNB_ADDRESS_TESTNET } from '../../../../shared/mock/address'
import * as AT from '../../../storybook/argTypes'
import { AddressEllipsis as Component } from './index'

type Args = {
  network: Network
  address: string
  width: number
}

const Template = ({ address, network, width }: Args) => (
  <div style={{ width: width || 400 }}>
    <Component address={address} chain={BNBChain} network={network} />
  </div>
)
export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Components/AddressEllipsis',
  argTypes: {
    network: AT.network,
    address: {
      options: [Network.Testnet, Network.Mainnet],
      mapping: {
        testnet: BNB_ADDRESS_TESTNET,
        mainnet: BNB_ADDRESS_MAINNET
      }
    }
  },
  args: { network: Network.Mainnet, address: BNB_ADDRESS_MAINNET }
}

export default meta
