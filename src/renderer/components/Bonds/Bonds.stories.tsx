import * as RD from '@devexperts/remote-data-ts'
import { useCallback, useState } from '@storybook/addons'
import { Meta, StoryFn } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import { Address, baseAmount } from '@xchainjs/xchain-util'

import { AddressValidation } from '../../services/clients'
import { NodeStatusEnum } from '../../services/thorchain/types'
import { Bonds as Component } from './Bonds'

const mockNodeInfo = (address: Address) => ({
  bond: baseAmount(100000000 * 40000000),
  award: baseAmount(100000000 * 400000),
  status: NodeStatusEnum.Active,
  address,
  nodeOperatorAddress: '',
  bondProviders: {
    nodeOperatorFee: baseAmount(100000000 * 400000),
    providers: []
  },
  signMembership: []
})
const addressValidation: AddressValidation = (_) => true

export const Default: StoryFn = () => {
  const [nodesList, setNodesList] = useState<Address[]>([])

  const removeNode = useCallback(
    (node: Address) => {
      setNodesList(nodesList.filter((current) => current !== node))
    },
    [nodesList, setNodesList]
  )
  const addNode = useCallback((node: string) => setNodesList([...nodesList, node]), [nodesList, setNodesList])

  const mockWalletAddresses = {
    THOR: [
      { address: 'thor1abcd1234', walletType: 'keystore' },
      { address: 'thor1xyz7890', walletType: 'ledger' }
    ],
    MAYA: [
      { address: 'maya1abcd1234', walletType: 'keystore' },
      { address: 'maya1xyz7890', walletType: 'ledger' }
    ]
  }
  return (
    <Component
      addressValidationThor={addressValidation}
      addressValidationMaya={addressValidation}
      network={Network.Testnet}
      addNode={addNode}
      removeNode={removeNode}
      goToNode={(node) => console.log('go to ', node)}
      goToAction={(action) => console.log('go to ', action)}
      reloadNodeInfos={() => console.log('reloadNodeInfos')}
      nodes={RD.success(nodesList.map((address) => mockNodeInfo(address)))}
      walletAddresses={mockWalletAddresses}
    />
  )
}

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Bonds/Bonds'
}

export default meta
