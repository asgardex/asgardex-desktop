import { Meta, StoryFn } from '@storybook/react'
import { BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { bn, assetToBase, assetAmount } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'

import { BSC_ADDRESS_TESTNET, RUNE_ADDRESS_TESTNET } from '../../../../shared/mock/address'
import { AssetBSC, AssetRuneNative } from '../../../../shared/utils/asset'
import { PoolShare as Component, Props } from './PoolShare'

const Template: StoryFn<Props> = (args) => <Component {...args} />

export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/PoolShare',
  argTypes: {
    loading: {
      control: {
        type: 'boolean'
      },
      defaultValue: false
    }
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '20px' }}>
        <Story />
      </div>
    )
  ],
  args: {
    asset: { asset: AssetBSC, decimal: BSC_GAS_ASSET_DECIMAL },
    assetPrice: assetToBase(assetAmount(120.1)),
    shares: { rune: assetToBase(assetAmount(1500)), asset: assetToBase(assetAmount(500)) },
    addresses: { rune: O.some(RUNE_ADDRESS_TESTNET), asset: O.some(BSC_ADDRESS_TESTNET) },
    priceAsset: AssetRuneNative,
    runePrice: assetToBase(assetAmount(400)),
    poolShare: bn(100),
    depositUnits: bn(20100000)
  }
}

export default meta
