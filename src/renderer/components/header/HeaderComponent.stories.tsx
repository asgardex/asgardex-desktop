import * as RD from '@devexperts/remote-data-ts'
import { Meta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import * as O from 'fp-ts/lib/Option'

import { AssetRuneNative } from '../../../shared/utils/asset'
import * as AT from '../../storybook/argTypes'
import { HeaderComponent as Component, Props } from './HeaderComponent'

const Template: StoryFn<Props> = (args: Props) => <Component {...args} />

export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Header',
  argTypes: {
    network: AT.network,
    keystore: AT.keystore
  },
  args: {
    keystore: O.none,
    lockHandler: () => console.log('lockHandler'),
    pricePools: O.none,
    runePrice: RD.initial,
    reloadRunePrice: () => console.log('reload rune price'),
    volume24PriceRune: RD.initial,
    reloadVolume24PriceRune: () => console.log('reload volume24 price'),
    setSelectedPricePool: () => console.log('setSelectedPricePool'),
    selectedPricePoolAsset: O.some(AssetRuneNative),
    midgardStatus: RD.initial,
    mimir: RD.initial,
    midgardUrl: RD.success('midgard-url'),
    thorchainNodeUrl: 'thorchain-node-url',
    thorchainRpcUrl: 'thorchain-rpc-url',
    network: Network.Mainnet
  }
}

export default meta
