import { Meta } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import * as O from 'fp-ts/lib/Option'

import { MOCK_WALLET_ADDRESSES } from '../../../shared/mock/wallet'
import { AccountAddressSelector as Component } from './AccountAddressSelector'

export const Default = () => (
  <Component
    addresses={MOCK_WALLET_ADDRESSES}
    network={Network.Testnet}
    selectedAddress={O.some(MOCK_WALLET_ADDRESSES[0])}
    onChangeAddress={({ address }) => console.log(`change address ${address}`)}
  />
)

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/AccountAddressSelector'
}

export default meta
