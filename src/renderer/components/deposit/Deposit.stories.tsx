import * as RD from '@devexperts/remote-data-ts'
import { StoryFn, Meta } from '@storybook/react'
import { AssetBSC, BSC_GAS_ASSET_DECIMAL, BSCChain } from '@xchainjs/xchain-bsc'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { assetAmount, assetToBase, bn } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'

import { BSC_ADDRESS_TESTNET, RUNE_ADDRESS_TESTNET } from '../../../shared/mock/address'
import { WalletType } from '../../../shared/wallet/types'
import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { mockWalletAddress } from '../../helpers/test/testWalletHelper'
import { DEFAULT_MIMIR_HALT } from '../../services/thorchain/const'
import { KeystoreState } from '../../services/wallet/types'
import { SymDepositView } from '../../views/deposit/add/SymDepositView'
import { ShareView } from '../../views/deposit/share/ShareView'
import { WithdrawDepositView } from '../../views/deposit/withdraw/WithdrawDepositView'
import { Protocol } from '../uielements/protocolSwitch/types'
import { Deposit, Props as DepositProps } from './Deposit'

const keystoreStateLocked: KeystoreState = O.some({ id: 123, name: 'My Wallet' })

const keystoreStateUnlocked: KeystoreState = O.some({
  id: 123,
  name: 'My Wallet',
  phrase: 'phrase'
})

const defaultProps: DepositProps = {
  haltedChains: [],
  mimirHalt: DEFAULT_MIMIR_HALT,
  asset: { asset: AssetBSC, decimal: BSC_GAS_ASSET_DECIMAL },
  poolDetail: RD.initial,
  shares: RD.success([
    {
      units: bn('300000000'),
      asset: AssetBSC,
      type: 'sym',
      assetAddress: O.some(BSC_ADDRESS_TESTNET),
      runeAddress: O.some(RUNE_ADDRESS_TESTNET),
      assetAddedAmount: assetToBase(assetAmount(1.5, THORCHAIN_DECIMAL))
    },
    {
      units: bn('100000000'),
      asset: AssetBSC,
      type: 'asym',
      assetAddress: O.some(BSC_ADDRESS_TESTNET),
      runeAddress: O.none,
      assetAddedAmount: assetToBase(assetAmount(1, THORCHAIN_DECIMAL))
    },
    {
      units: bn('200000000'),
      asset: AssetRuneNative,
      type: 'asym',
      assetAddress: O.none,
      runeAddress: O.some(RUNE_ADDRESS_TESTNET),
      assetAddedAmount: assetToBase(assetAmount(2, THORCHAIN_DECIMAL))
    }
  ]),
  ShareContent: ShareView,
  SymDepositContent: SymDepositView,
  WidthdrawContent: WithdrawDepositView,
  dexWalletAddress: mockWalletAddress(),
  keystoreState: keystoreStateLocked,
  assetWalletAddress: mockWalletAddress({ address: BSC_ADDRESS_TESTNET, chain: BSCChain }),
  protocol: Protocol.MAYAChain,
  assetWalletType: WalletType.Keystore,
  dexWalletType: WalletType.Keystore
}

export const Default: StoryFn = () => <Deposit {...defaultProps} />
Default.storyName = 'default'

export const NoWallet: StoryFn = () => {
  const props: DepositProps = {
    ...defaultProps,
    keystoreState: O.none
  }
  return <SymDepositView {...props} />
}
NoWallet.storyName = 'no wallet'

export const LockedWallet: StoryFn = () => {
  const props: DepositProps = {
    ...defaultProps,
    keystoreState: keystoreStateUnlocked
  }
  return <SymDepositView {...props} />
}
LockedWallet.storyName = 'locked wallet'

const meta: Meta = {
  component: Deposit,
  title: 'Components/Deposit/Deposit'
}

export default meta
