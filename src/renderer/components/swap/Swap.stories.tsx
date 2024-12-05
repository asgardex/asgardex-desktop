import * as RD from '@devexperts/remote-data-ts'
import { Meta, StoryFn } from '@storybook/react'
import { BTCChain, BTC_DECIMAL } from '@xchainjs/xchain-bitcoin'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { assetAmount, assetToBase, assetToString, baseAmount, bn } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { mockValidatePassword$ } from '../../../shared/mock/wallet'
import { AssetBTC, AssetRuneNative } from '../../../shared/utils/asset'
import { WalletType } from '../../../shared/wallet/types'
import { ONE_BN } from '../../const'
import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { INITIAL_SWAP_STATE } from '../../services/chain/const'
import { SwapState } from '../../services/chain/types'
import { Swap as Component } from './Swap'
import { SwapAsset, SwapProps } from './Swap.types'

const sourceAsset: SwapAsset = { asset: AssetRuneNative, decimal: THORCHAIN_DECIMAL, price: ONE_BN }
const targetAsset: SwapAsset = { asset: AssetBTC, decimal: BTC_DECIMAL, price: bn('56851.67420275761') }

/* Mock all (default) data needed by `Swap` commponent */
const defaultProps: SwapProps = {
  disableSwapAction: false,
  keystore: O.none,
  poolAssets: [AssetBTC, AssetRuneNative],
  assets: { source: sourceAsset, target: targetAsset },
  poolAddressThor: O.some({
    protocol: THORChain,
    chain: BTCChain,
    address: 'vault-address',
    router: O.some('router-address'),
    halted: false
  }),
  poolAddressMaya: O.some({
    protocol: THORChain,
    chain: BTCChain,
    address: 'vault-address',
    router: O.some('router-address'),
    halted: false
  }),
  poolDetails: [],
  // mock successfull result of swap$
  swap$: (params) =>
    Rx.of(params).pipe(
      RxOp.tap((params) => console.log('swap$ ', params)),
      RxOp.switchMap((_) =>
        Rx.of<SwapState>({
          ...INITIAL_SWAP_STATE,
          step: 3,
          swapTx: RD.success('tx-hash'),
          swap: RD.success(true),
          stepsTotal: 3
        })
      )
    ),
  poolsData: {
    [assetToString(AssetBTC)]: {
      assetBalance: baseAmount(1),
      dexBalance: baseAmount(20)
    },
    [assetToString(AssetBTC)]: {
      assetBalance: baseAmount(1),
      dexBalance: baseAmount(3000)
    }
  },
  walletBalances: {
    balances: O.some([
      {
        asset: AssetRuneNative,
        amount: assetToBase(assetAmount(100)),
        walletType: WalletType.Keystore,
        walletAccount: 0,
        walletIndex: 0,
        walletAddress: 'wallet-address-rune',
        hdMode: 'default'
      },
      {
        asset: AssetBTC,
        walletAccount: 0,
        walletIndex: 0,
        amount: assetToBase(assetAmount(1)),
        walletType: WalletType.Keystore,
        walletAddress: 'wallet-address-btc',
        hdMode: 'default'
      }
    ]),
    loading: false
  },
  goToTransaction: (txHash) => {
    console.log(txHash)
    return Promise.resolve(true)
  },
  getExplorerTxUrl: (txHash: TxHash) => O.some(`url/asset-${txHash}`),
  // mock password validation
  // Password: "123"
  validatePassword$: mockValidatePassword$,
  reloadFees: () => console.log('reloadFees'),
  reloadApproveFee: () => console.log('reloadFees'),
  reloadBalances: () => console.log('reloadBalances'),
  fees$: () =>
    Rx.of(
      RD.success({
        inFee: { amount: baseAmount(10000000), asset: AssetRuneNative },
        outFee: { amount: baseAmount(1000000), asset: AssetBTC }
      })
    ),
  approveFee$: () => Rx.of(RD.success(baseAmount(10000000))),
  sourceKeystoreAddress: O.some('source-wallet-address'),
  sourceLedgerAddress: O.some('source-ledger-address'),
  targetKeystoreAddress: O.some('target-wallet-address'),
  targetLedgerAddress: O.some('target-ledger-address'),
  recipientAddress: O.some('target-address'),
  sourceWalletType: WalletType.Ledger,
  targetWalletType: O.some(WalletType.Keystore),
  onChangeAsset: ({ source, target, sourceWalletType, targetWalletType }) =>
    console.log('change asset', assetToString(source), sourceWalletType, assetToString(target), targetWalletType),
  network: Network.Testnet,
  slipTolerance: 5,
  changeSlipTolerance: () => console.log('changeSlipTolerance'),
  approveERC20Token$: () => Rx.of(RD.success('txHash')),
  isApprovedERC20Token$: () => Rx.of(RD.success(true)),
  importWalletHandler: () => console.log('import wallet'),
  addressValidator: () => Promise.resolve(true),
  hidePrivateData: false,
  reloadTxStatus: () => console.log('reloadBalances')
}

export const Default: StoryFn = () => <Component {...defaultProps} />

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Swap'
}

export default meta
