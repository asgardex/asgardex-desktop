import { ComponentMeta } from '@storybook/react'
import { BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { Fees, FeeType, TxHash } from '@xchainjs/xchain-client'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import { getMockRDValueFactory, RDStatus } from '../../../../../shared/mock/rdByStatus'
import { mockValidatePassword$ } from '../../../../../shared/mock/wallet'
import { AssetBSC } from '../../../../../shared/utils/asset'
import { WalletType } from '../../../../../shared/wallet/types'
import { THORCHAIN_DECIMAL } from '../../../../helpers/assetHelper'
import { mockWalletBalance } from '../../../../helpers/test/testWalletHelper'
import { FeesRD, SendTxStateHandler } from '../../../../services/chain/types'
import { ApiError, ErrorId, WalletBalance } from '../../../../services/wallet/types'
import { SendFormETH as Component } from './SendFormETH'

type Args = {
  txRDStatus: RDStatus
  feeRDStatus: RDStatus
  balance: string
  walletType: WalletType
}

const Template = ({ txRDStatus, feeRDStatus, balance, walletType }: Args) => {
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

  const bscBalance: WalletBalance = mockWalletBalance({
    asset: AssetBSC,
    amount: assetToBase(assetAmount(balance, BSC_GAS_ASSET_DECIMAL)),
    walletAddress: 'BSC wallet address'
  })

  const runeBalance: WalletBalance = mockWalletBalance({
    amount: assetToBase(assetAmount(2, THORCHAIN_DECIMAL))
  })

  const feesRD: FeesRD = FP.pipe(
    feeRDStatus,
    getMockRDValueFactory<Error, Fees>(
      () => ({
        type: FeeType.PerByte,
        fastest: assetToBase(assetAmount(0.002499, BSC_GAS_ASSET_DECIMAL)),
        fast: assetToBase(assetAmount(0.002079, BSC_GAS_ASSET_DECIMAL)),
        average: assetToBase(assetAmount(0.001848, BSC_GAS_ASSET_DECIMAL))
      }),
      () => Error('getting fees failed')
    )
  )

  return (
    <Component
      asset={{ asset: AssetBSC, walletAddress: 'avax-address', walletType, walletIndex: 0, hdMode: 'default' }}
      transfer$={transfer$}
      balances={[bscBalance, runeBalance]}
      balance={bscBalance}
      fees={feesRD}
      reloadFeesHandler={() => console.log('reload fees')}
      validatePassword$={mockValidatePassword$}
      network="testnet"
      openExplorerTxUrl={(txHash: TxHash) => {
        console.log(`Open explorer - tx hash ${txHash}`)
        return Promise.resolve(true)
      }}
      getExplorerTxUrl={(txHash: TxHash) => O.some(`url/asset-${txHash}`)}
    />
  )
}
export const Default = Template.bind({})

const meta: ComponentMeta<typeof Template> = {
  component: Component,
  title: 'Wallet/SendFormETH',
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
    balance: '2'
  }
}

export default meta
