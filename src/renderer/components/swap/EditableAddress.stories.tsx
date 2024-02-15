import { ComponentMeta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import { Address } from '@xchainjs/xchain-util'

import { BNB_ADDRESS_TESTNET } from '../../../shared/mock/address'
import { AssetBNB } from '../../../shared/utils/asset'
import { eqString } from '../../helpers/fp/eq'
import { EditableAddress as Component, EditableAddressProps } from './EditableAddress'

const bnbAddress = BNB_ADDRESS_TESTNET

const defaultProps: EditableAddressProps = {
  asset: AssetBNB,
  address: bnbAddress,
  network: Network.Testnet,
  onChangeAddress: () => console.log('address changed'),
  onChangeEditableAddress: () => console.log('address changed'),
  onChangeEditableMode: () => console.log('edit mode changed'),
  addressValidator: (address: Address) => Promise.resolve(eqString.equals(address, bnbAddress)),
  hidePrivateData: false
}
export const Default: StoryFn = () => <Component {...defaultProps} />

const meta: ComponentMeta<typeof Component> = {
  component: Component,
  title: 'Components/EditableAddress'
}

export default meta
