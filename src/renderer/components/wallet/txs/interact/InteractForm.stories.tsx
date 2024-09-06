import { useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Meta } from '@storybook/react'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { Address, assetAmount, assetToBase, BaseAmount, baseAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import { getMockRDValueFactory, RDStatus } from '../../../../../shared/mock/rdByStatus'
import { mockValidatePassword$ } from '../../../../../shared/mock/wallet'
import { WalletType } from '../../../../../shared/wallet/types'
import { useThorchainQueryContext } from '../../../../contexts/ThorchainQueryContext'
import { mockWalletBalance } from '../../../../helpers/test/testWalletHelper'
import { FeeRD } from '../../../../services/chain/types'
import { InteractStateHandler, NodeStatusEnum, RunePoolProvider } from '../../../../services/thorchain/types'
import { ApiError, ErrorId, WalletBalance } from '../../../../services/wallet/types'
import { InteractType } from './Interact.types'
import { InteractFormThor as Component } from './InteractFormThor'

type Args = {
  interactType: InteractType
  txRDStatus: RDStatus
  feeRDStatus: RDStatus
  balance: string
  validAddress: boolean
  walletType: WalletType
}

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

const Template = ({ interactType, txRDStatus, feeRDStatus, balance, validAddress, walletType }: Args) => {
  const interact$: InteractStateHandler = (_) => {
    const getCurrentStep = () => {
      switch (txRDStatus) {
        case 'initial':
          return 0
        case 'pending':
          return 1
        case 'success':
          return 2
        case 'error':
          return 2
      }
    }
    return Rx.of({
      step: getCurrentStep(),
      stepsTotal: 2,
      txRD: FP.pipe(
        txRDStatus,
        getMockRDValueFactory<ApiError, TxHash>(
          () => 'tx-hash',
          () => ({
            msg: 'error message',
            errorId: ErrorId.SEND_TX
          })
        )
      )
    })
  }
  const { thorchainQuery } = useThorchainQueryContext()
  const [nodesList] = useState<Address[]>([])

  const mockRunePoolProvider: RunePoolProvider = {
    address: 'thor1exampleaddress',
    value: baseAmount(1000), // Replace with the appropriate base amount
    pnl: baseAmount(100),
    depositAmount: baseAmount(1000),
    withdrawAmount: baseAmount(500),
    addHeight: O.some(12345),
    withdrawHeight: O.some(12346),
    walletType: 'keystore'
  }
  const feeRD: FeeRD = FP.pipe(
    feeRDStatus,
    getMockRDValueFactory<Error, BaseAmount>(
      () => baseAmount(2000000),
      () => Error('getting fees failed')
    )
  )

  const dexBalance: WalletBalance = mockWalletBalance({
    amount: assetToBase(assetAmount(balance))
  })

  return (
    <Component
      interactType={interactType}
      walletType={walletType}
      walletAccount={0}
      walletIndex={0}
      hdMode="default"
      interact$={interact$}
      balance={dexBalance}
      addressValidation={(_: string) => validAddress}
      fee={feeRD}
      reloadFeesHandler={() => console.log('reload fees')}
      validatePassword$={mockValidatePassword$}
      network={Network.Testnet}
      thorchainQuery={thorchainQuery}
      openExplorerTxUrl={(txHash: TxHash) => {
        console.log(`Open explorer - tx hash ${txHash}`)
        return Promise.resolve(true)
      }}
      getExplorerTxUrl={(txHash: TxHash) => O.some(`url/asset-${txHash}`)}
      poolDetails={[]}
      nodes={RD.success(nodesList.map((address) => mockNodeInfo(address)))}
      runePoolProvider={RD.success(mockRunePoolProvider)}
      thorchainLastblock={RD.success([])}
    />
  )
}

export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Wallet/InteractForm',
  argTypes: {
    interactType: {
      control: { type: 'select', options: ['bond', 'unbond', 'leave', 'custom'] }
    },
    txRDStatus: {
      control: { type: 'select', options: ['pending', 'error', 'success'] }
    },
    feeRDStatus: {
      control: { type: 'select', options: ['initial', 'pending', 'error', 'success'] }
    },
    walletType: {
      control: { type: 'select', options: ['keystore', 'ledger'] }
    }
  },
  args: {
    interactType: 'bond',
    txRDStatus: 'success',
    walletType: 'keystore',
    balance: '2',
    validAddress: true
  }
}

export default meta
