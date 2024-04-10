import { Meta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import { Address } from '@xchainjs/xchain-util'

import { BSC_ADDRESS_MAINNET } from '../../../shared/mock/address'
import { AssetBTC } from '../../../shared/utils/asset'
import { eqString } from '../../helpers/fp/eq'
import { EditableAddress as Component, EditableAddressProps } from './EditableAddress'

const bscAddress = BSC_ADDRESS_MAINNET

const defaultProps: EditableAddressProps = {
  asset: AssetBTC,
  address: bscAddress,
  network: Network.Testnet,
  onChangeAddress: () => console.log('address changed'),
  onChangeEditableAddress: () => console.log('address changed'),
  onChangeEditableMode: () => console.log('edit mode changed'),
  addressValidator: (address: Address) => Promise.resolve(eqString.equals(address, bscAddress)),
  hidePrivateData: false
}
export const Default: StoryFn = () => <Component {...defaultProps} />

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/EditableAddress'
}

export default meta
