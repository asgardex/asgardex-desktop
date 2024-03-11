import { Meta, StoryObj } from '@storybook/react'
import { Fees, FeeType, Network, TxHash } from '@xchainjs/xchain-client'
import { ETH_GAS_ASSET_DECIMAL as ETH_DECIMAL } from '@xchainjs/xchain-ethereum'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import { getMockRDValueFactory, RDStatus } from '../../../../../shared/mock/rdByStatus'
import { mockValidatePassword$ } from '../../../../../shared/mock/wallet'
import { AssetETH } from '../../../../../shared/utils/asset'
import { WalletType } from '../../../../../shared/wallet/types'
import { THORCHAIN_DECIMAL } from '../../../../helpers/assetHelper'
import { mockWalletBalance } from '../../../../helpers/test/testWalletHelper'
import { FeesRD, SendTxStateHandler } from '../../../../services/chain/types'
import { ApiError, ErrorId, WalletBalance } from '../../../../services/wallet/types'
import { SendFormEVM as Component, Props } from './SendFormEVM'

type StoryArgs = Props & {
  txRDStatus: RDStatus
  feeRDStatus: RDStatus
  walletType: WalletType
}

export default {
  title: 'Wallet/SendFormETH',
  component: Component,
  argTypes: {
    // Define controls for actual component props and any additional story controls
    walletType: {
      control: { type: 'select', options: ['keystore', 'ledger'] }
    }
  },
  args: {}
} as Meta<typeof Component>

// Define the default story using StoryObj
export const Default: StoryObj<StoryArgs> = {
  render: (args: StoryArgs) => {
    const { txRDStatus, feeRDStatus, walletType, balance } = args
    // Prepare the component props based on story Args
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

    const feesRD: FeesRD = FP.pipe(
      feeRDStatus,
      getMockRDValueFactory<Error, Fees>(
        () => ({
          type: FeeType.PerByte,
          fastest: assetToBase(assetAmount(0.002499, ETH_DECIMAL)),
          fast: assetToBase(assetAmount(0.002079, ETH_DECIMAL)),
          average: assetToBase(assetAmount(0.001848, ETH_DECIMAL))
        }),
        () => Error('getting fees failed')
      )
    )

    const ethBalance = mockWalletBalance({
      asset: AssetETH,
      amount: assetToBase(assetAmount(balance.amount.amount().toNumber(), ETH_DECIMAL)),
      walletAddress: 'ETH wallet address'
    })
    const runeBalance: WalletBalance = mockWalletBalance({
      amount: assetToBase(assetAmount(2, THORCHAIN_DECIMAL))
    })

    return (
      <Component
        {...args}
        asset={{ asset: AssetETH, walletAddress: 'eth-address', walletType, walletIndex: 0, hdMode: 'default' }}
        transfer$={transfer$}
        balances={[ethBalance, runeBalance]}
        balance={ethBalance}
        fees={feesRD}
        reloadFeesHandler={() => console.log('Reload fees handler invoked')}
        validatePassword$={mockValidatePassword$}
        network={Network.Testnet}
        openExplorerTxUrl={(txHash: TxHash) => {
          console.log(`Open explorer - tx hash ${txHash}`)
          // Simulate opening an explorer URL and returning a Promise<boolean>
          return Promise.resolve(true)
        }}
        getExplorerTxUrl={(txHash: TxHash) => O.some(`url/asset-${txHash}`)}
      />
    )
  },
  args: {
    txRDStatus: 'success',
    feeRDStatus: 'success',
    walletType: 'keystore'
  }
}
