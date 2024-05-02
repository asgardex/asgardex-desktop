import { Meta } from '@storybook/react'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain-query'
import { assetAmount, assetToBase, BaseAmount, baseAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import { getMockRDValueFactory, RDStatus } from '../../../../../shared/mock/rdByStatus'
import { mockValidatePassword$ } from '../../../../../shared/mock/wallet'
import { AssetDOGE } from '../../../../../shared/utils/asset'
import { WalletType } from '../../../../../shared/wallet/types'
import { useThorchainQueryContext } from '../../../../contexts/ThorchainQueryContext'
import { mockWalletBalance } from '../../../../helpers/test/testWalletHelper'
import { FeeRD, SendTxStateHandler } from '../../../../services/chain/types'
import { ApiError, ErrorId, WalletBalance } from '../../../../services/wallet/types'
import { SendFormBNB as Component } from './SendFormBNB'

type Args = {
  txRDStatus: RDStatus
  feeRDStatus: RDStatus
  balance: string
  validAddress: boolean
  walletType: WalletType
}

const Template = ({ txRDStatus, feeRDStatus, balance, validAddress, walletType }: Args) => {
  const transfer$: SendTxStateHandler = (_) =>
    Rx.of({
      steps: { current: txRDStatus === 'initial' ? 0 : 1, total: 1 },
      status: FP.pipe(
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

  const feeRD: FeeRD = FP.pipe(
    feeRDStatus,
    getMockRDValueFactory<Error, BaseAmount>(
      () => baseAmount(375000),
      () => Error('getting fees failed')
    )
  )

  const dogeBalance: WalletBalance = mockWalletBalance({
    asset: AssetDOGE,
    amount: assetToBase(assetAmount(balance)),
    walletAddress: 'AssetDOGE wallet address'
  })

  const dexBalance: WalletBalance = mockWalletBalance({
    asset: AssetRuneNative,
    amount: assetToBase(assetAmount(234)),
    walletAddress: 'AssetRuneNative wallet address'
  })
  const { thorchainQuery } = useThorchainQueryContext()
  return (
    <Component
      asset={{ asset: AssetDOGE, walletAddress: 'bnb-address', walletType, walletIndex: 0, hdMode: 'default' }}
      transfer$={transfer$}
      balances={[dogeBalance, dexBalance]}
      balance={dogeBalance}
      addressValidation={(_: string) => validAddress}
      fee={feeRD}
      reloadFeesHandler={() => console.log('reload fees')}
      validatePassword$={mockValidatePassword$}
      thorchainQuery={thorchainQuery}
      network={Network.Testnet}
      openExplorerTxUrl={(txHash: TxHash) => {
        console.log(`Open explorer - tx hash ${txHash}`)
        return Promise.resolve(true)
      }}
      getExplorerTxUrl={(txHash: TxHash) => O.some(`url/asset-${txHash}`)}
      poolDetails={[]}
    />
  )
}
export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Wallet/SendFormBNB',
  argTypes: {
    txRDStatus: {
      control: { type: 'select', options: ['pending', 'error', 'success'] }
    },
    feeRDStatus: {
      control: { type: 'select', options: ['initial', 'pending', 'error', 'success'] }
    },
    walletType: {
      control: { type: 'select', options: ['keystore', 'ledger'] }
    },
    balance: {
      control: { type: 'text' }
    }
  },
  args: {
    txRDStatus: 'success',
    feeRDStatus: 'success',
    walletType: 'keystore',
    balance: '2',
    validAddress: true
  }
}

export default meta
