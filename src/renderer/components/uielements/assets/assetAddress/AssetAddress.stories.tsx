import { Meta } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'

import { BSC_ADDRESS_TESTNET } from '../../../../../shared/mock/address'
import { AssetBSC } from '../../../../../shared/utils/asset'
import { Size } from '../assetIcon'
import { AssetAddress as Component } from './AssetAddress'

type Args = {
  size: Size
  width: string
}
const Template = ({ size, width }: Args) => (
  <div style={{ width }}>
    <Component asset={AssetBSC} size={size} address={BSC_ADDRESS_TESTNET} network={Network.Mainnet} />
  </div>
)

export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Components/AssetAddress',
  argTypes: {
    size: {
      name: 'Size',
      control: {
        type: 'select',
        options: ['xsmall', 'small', 'normal', 'big', 'large']
      },
      defaultValue: 'normal'
    },
    width: {
      name: 'Wrapper width',
      control: {
        type: 'select',
        options: ['100%', '300px', '500px']
      },
      defaultValue: '100%'
    }
  }
}

export default meta
