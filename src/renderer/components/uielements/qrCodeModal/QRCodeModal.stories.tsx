import { ComponentMeta } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import * as FP from 'fp-ts/lib/function'

import { BNB_ADDRESS_MAINNET, BNB_ADDRESS_TESTNET } from '../../../../shared/mock/address'
import { AssetBNB } from '../../../../shared/utils/asset'
import * as AT from '../../../storybook/argTypes'
import { QRCodeModal as Component } from './QRCodeModal'

type StoryArgs = {
  network: Network
  visible: boolean
  onOkHandler: FP.Lazy<void>
  onCancelHandler: FP.Lazy<void>
}

const Template = ({ network, visible, onCancelHandler, onOkHandler }: StoryArgs) => (
  <Component
    asset={AssetBNB}
    address={network === Network.Testnet ? BNB_ADDRESS_TESTNET : BNB_ADDRESS_MAINNET}
    network={network}
    visible={visible}
    onCancel={onCancelHandler}
    onOk={onOkHandler}
  />
)
export const Default = Template.bind({})

const meta: ComponentMeta<typeof Template> = {
  component: Component,
  title: 'Components/QRCodeModal',
  argTypes: {
    network: AT.network,
    onOkHandler: {
      action: 'onOkHandler'
    },
    onCancelHandler: {
      action: 'onCancelHandler'
    }
  },
  args: { network: Network.Mainnet, visible: true }
}

export default meta
