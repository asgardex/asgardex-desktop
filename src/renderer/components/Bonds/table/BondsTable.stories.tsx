import React, { useCallback, useState } from 'react'

import { Meta, Story } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import { Address, baseAmount } from '@xchainjs/xchain-util'

import { NodeStatusEnum } from '../../../services/thorchain/types'
import { BondsTable } from './BondsTable'

const mockNodeInfo = (address: Address) => ({
  bond: baseAmount(100000000 * 40000000),
  award: baseAmount(100000000 * 400000),
  status: NodeStatusEnum.Active,
  address,
  bondProviders: {
    nodeOperatorFee: baseAmount(100000000 * 400000),
    providers: []
  },
  signMembership: []
})

export const Default: Story = () => {
  // const nodesSelect: Record<Address, RDStatus> = {
  //   thor1766mazrxs5asuscepa227r6ekr657234f8p7nf: firstNodeRdKnob,
  //   thor1766mazrxs5asuscepa227r6ekr657234f9asda: secondNodeRdKnob,
  //   thor1766mazrxs5asuscepa227r6ekr657234fkswjh: thirdNodeRdKnob
  // }

  const [nodesList, setNodesList] = useState<Address[]>([
    'thor1766mazrxs5asuscepa227r6ekr657234f8p7nf',
    'thor1766mazrxs5asuscepa227r6ekr657234f9asda',
    'thor1766mazrxs5asuscepa227r6ekr657234fkswjh'
  ])

  const removeNode = useCallback(
    (node: Address) => {
      setNodesList(nodesList.filter((current) => current !== node))
    },
    [nodesList, setNodesList]
  )
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
    <BondsTable
      network={Network.Testnet}
      removeNode={removeNode}
      goToNode={(node) => console.log('go to ', node)}
      nodes={nodesList.map((address) => mockNodeInfo(address))}
      walletAddresses={mockWalletAddresses}
      goToAction={(action) => console.log('go to ', action)}
    />
  )
}
Default.storyName = 'default'

const meta: Meta = {
  component: BondsTable,
  title: 'Bonds/BondsTable'
}

export default meta
