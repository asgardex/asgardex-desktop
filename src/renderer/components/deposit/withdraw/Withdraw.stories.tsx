import * as RD from '@devexperts/remote-data-ts'
import { Story, Meta } from '@storybook/react'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { AnyAsset, assetAmount, assetToBase, assetToString, baseAmount, bn } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { thorDetails } from '../../../../shared/api/types'
import { BSC_ADDRESS_MAINNET } from '../../../../shared/mock/address'
import { mockValidatePassword$ } from '../../../../shared/mock/wallet'
import { AssetRuneNative, AssetBSC } from '../../../../shared/utils/asset'
import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { mockWalletAddress } from '../../../helpers/test/testWalletHelper'
import { INITIAL_WITHDRAW_STATE } from '../../../services/chain/const'
import { WithdrawState$ } from '../../../services/chain/types'
import { DEFAULT_MIMIR_HALT } from '../../../services/thorchain/const'
import { Withdraw, Props as WitdrawProps } from './Withdraw'

const defaultProps: WitdrawProps = {
  haltedChains: [],
  mimirHalt: DEFAULT_MIMIR_HALT,
  asset: { asset: AssetBSC, decimal: BSC_GAS_ASSET_DECIMAL },
  assetWalletAddress: mockWalletAddress({ address: BSC_ADDRESS_MAINNET, chain: BTCChain }),
  dexWalletAddress: mockWalletAddress(),
  dexPrice: bn(1),
  assetPrice: bn(60.972),
  dexBalance: O.some(assetToBase(assetAmount(100))),
  selectedPriceAsset: AssetRuneNative,
  reloadFees: () => console.log('reload fees'),
  shares: {
    rune: assetToBase(assetAmount(10, THORCHAIN_DECIMAL)),
    asset: assetToBase(assetAmount(30, BSC_GAS_ASSET_DECIMAL))
  },
  disabled: false,
  openRuneExplorerTxUrl: (txHash: TxHash) => {
    console.log(`Open RUNE explorer - tx hash ${txHash}`)
    return Promise.resolve(true)
  },
  getRuneExplorerTxUrl: (txHash: TxHash) => O.some(`url/asset-${txHash}`),
  // mock password validation
  // Password: "123"
  validatePassword$: mockValidatePassword$,
  reloadBalances: () => console.log('reload balances'),
  // mock successfull result of withdraw$
  withdraw$: (params) =>
    Rx.of(params).pipe(
      RxOp.tap((params) => console.log('withdraw$ ', params)),
      RxOp.switchMap(
        (_): WithdrawState$ =>
          Rx.of({
            ...INITIAL_WITHDRAW_STATE,
            step: 3,
            withdrawTx: RD.success('rune-tx-hash'),
            withdraw: RD.success(true)
          })
      )
    ),
  fees$: (_: AnyAsset) =>
    Rx.of(
      RD.success({
        rune: {
          inFee: assetToBase(assetAmount(0.3)),
          outFee: assetToBase(assetAmount(0.7))
        },
        asset: {
          asset: AssetBSC,
          amount: assetToBase(assetAmount(0.5))
        }
      })
    ),
  network: Network.Testnet,
  poolsData: {
    [assetToString(AssetBSC)]: {
      assetBalance: baseAmount(1),
      dexBalance: baseAmount(20)
    }
  },
  dex: thorDetails
}

export const Default: Story = () => <Withdraw {...defaultProps} />
Default.storyName = 'default'

export const FeesNotCovered: Story = () => {
  const props: WitdrawProps = {
    ...defaultProps,
    dexBalance: O.some(assetToBase(assetAmount(0.5)))
  }
  return <Withdraw {...props} />
}
FeesNotCovered.storyName = 'error - fees not covered'

export const ErrorNoFee: Story = () => {
  const props: WitdrawProps = {
    ...defaultProps,
    fees$: (_: AnyAsset) => Rx.of(RD.failure(Error('no fees')))
  }
  return <Withdraw {...props} />
}
ErrorNoFee.storyName = 'error - no fee'

const meta: Meta = {
  component: Withdraw,
  title: 'Components/Deposit/Withdraw'
}

export default meta
