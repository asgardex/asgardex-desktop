import { Meta } from '@storybook/react'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { assetAmount, assetToBase, BaseAmount, baseAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import { thorDetails } from '../../../../../shared/api/types'
import { getMockRDValueFactory, RDStatus } from '../../../../../shared/mock/rdByStatus'
import { mockValidatePassword$ } from '../../../../../shared/mock/wallet'
import { AssetMaya, AssetRuneNative } from '../../../../../shared/utils/asset'
import { WalletType } from '../../../../../shared/wallet/types'
import { AssetUSDC } from '../../../../const'
import { mockWalletBalance } from '../../../../helpers/test/testWalletHelper'
import { MayaScanPrice, MayaScanPriceRD } from '../../../../hooks/useMayascanPrice'
import { FeeRD, SendTxStateHandler } from '../../../../services/chain/types'
import { ApiError, ErrorId, WalletBalance } from '../../../../services/wallet/types'
import { SendFormCOSMOS as Component } from './SendFormCOSMOS'

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
      () => baseAmount(2000000),
      () => Error('getting fees failed')
    )
  )

  const dexBalance: WalletBalance = mockWalletBalance({
    amount: assetToBase(assetAmount(balance))
  })

  const addresses = [
    { address: 'thor-address-1', chain: THORChain, name: 'THOR Address 1' },
    { address: 'thor-address-2', chain: THORChain, name: 'THOR Address 2' }
  ]
  const mayaScanPriceRD: MayaScanPriceRD = FP.pipe(
    'success', // Replace with 'pending' or 'error' to mock other states
    getMockRDValueFactory<Error, MayaScanPrice>(
      () => ({
        mayaPriceInCacao: { asset: AssetMaya, amount: baseAmount(10, 6) },
        mayaPriceInUsd: { asset: AssetUSDC, amount: baseAmount(15, 4) },
        cacaoPriceInUsd: { asset: AssetUSDC, amount: baseAmount(1.5, 6) }
      }),
      () => Error('Error fetching maya price')
    )
  )
  return (
    <Component
      asset={{
        asset: AssetRuneNative,
        walletAddress: 'thorxyz',
        walletType,
        walletAccount: 0,
        walletIndex: 0,
        hdMode: 'default'
      }}
      trustedAddresses={{ addresses }}
      transfer$={transfer$}
      balances={[dexBalance]}
      balance={dexBalance}
      addressValidation={(_: string) => validAddress}
      fee={feeRD}
      reloadFeesHandler={() => console.log('reload fees')}
      validatePassword$={mockValidatePassword$}
      network={Network.Testnet}
      openExplorerTxUrl={(txHash: TxHash) => {
        console.log(`Open explorer - tx hash ${txHash}`)
        return Promise.resolve(true)
      }}
      getExplorerTxUrl={(txHash: TxHash) => O.some(`url/asset-${txHash}`)}
      poolDetails={[]}
      oPoolAddress={O.none}
      dex={thorDetails}
      mayaScanPrice={mayaScanPriceRD}
    />
  )
}
export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Wallet/SendFormTHOR',
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
