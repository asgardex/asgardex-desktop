import * as RD from '@devexperts/remote-data-ts'
import { BaseStory } from '@storybook/addons'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'
import * as NEA from 'fp-ts/lib/NonEmptyArray'

import { AssetBNB, AssetRune67C } from '../../../../shared/utils/asset'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { mockWalletBalance } from '../../../helpers/test/testWalletHelper'
import { OpenExplorerTxUrl } from '../../../services/clients'
import { WalletBalance, WalletBalances } from '../../../services/wallet/types'
import { AssetDetails } from './index'

const bnbBalance: WalletBalance = mockWalletBalance({
  asset: AssetBNB,
  amount: assetToBase(assetAmount(1.1)),
  walletAddress: 'BNB address'
})

const runeBnbBalance: WalletBalance = mockWalletBalance({
  asset: AssetRune67C,
  amount: assetToBase(assetAmount(2.2)),
  walletAddress: 'BNB.Rune address'
})

const runeNativeBalance: WalletBalance = mockWalletBalance()

const runeBalanceEmpty: WalletBalance = { ...runeBnbBalance, amount: ZERO_BASE_AMOUNT }
const bnbBalanceEmpty: WalletBalance = { ...bnbBalance, amount: ZERO_BASE_AMOUNT }
const getBalances = (balances: WalletBalances) => NEA.fromArray<WalletBalance>(balances)
const balances = getBalances([bnbBalance, runeBnbBalance, runeNativeBalance])
const openExplorerTxUrl: OpenExplorerTxUrl = (txHash: TxHash) => {
  console.log(`Open explorer - tx hash ${txHash}`)
  return Promise.resolve(true)
}

export const StoryBNB: BaseStory<never, JSX.Element> = () => (
  <AssetDetails
    walletType="keystore"
    walletAddress="bnb-address"
    txsPageRD={RD.initial}
    balances={balances}
    asset={AssetBNB}
    network={Network.Testnet}
    openExplorerTxUrl={openExplorerTxUrl}
    disableSend={false}
  />
)
StoryBNB.storyName = 'BNB'

export const StoryRuneTxSuccess: BaseStory<never, JSX.Element> = () => (
  <AssetDetails
    walletType="keystore"
    walletAddress="thor-address"
    txsPageRD={RD.initial}
    balances={balances}
    asset={AssetRune67C}
    network={Network.Testnet}
    openExplorerTxUrl={openExplorerTxUrl}
    disableSend={false}
  />
)
StoryRuneTxSuccess.storyName = 'RUNE - tx success'

export const StoryRuneNoSend: BaseStory<never, JSX.Element> = () => (
  <AssetDetails
    walletType="keystore"
    walletAddress="thor-address"
    txsPageRD={RD.initial}
    balances={balances}
    asset={AssetRune67C}
    network={Network.Testnet}
    openExplorerTxUrl={openExplorerTxUrl}
    disableSend={true}
  />
)
StoryRuneNoSend.storyName = 'RUNE - no send'

export const StoryRuneTxError: BaseStory<never, JSX.Element> = () => (
  <AssetDetails
    walletType="keystore"
    walletAddress="bnb-address"
    txsPageRD={RD.initial}
    balances={balances}
    asset={AssetRune67C}
    network={Network.Testnet}
    openExplorerTxUrl={openExplorerTxUrl}
    disableSend={false}
  />
)
StoryRuneTxError.storyName = 'RUNE - tx error'

export const StoryRuneNoBalances: BaseStory<never, JSX.Element> = () => (
  <AssetDetails
    walletType="keystore"
    walletAddress="bnb-address"
    txsPageRD={RD.initial}
    balances={getBalances([runeBalanceEmpty, bnbBalance])}
    asset={AssetRune67C}
    network={Network.Testnet}
    openExplorerTxUrl={openExplorerTxUrl}
    disableSend={false}
  />
)
StoryRuneNoBalances.storyName = 'RUNE - disabled - no balance'

export const StoryRuneFeeNotCovered: BaseStory<never, JSX.Element> = () => (
  <AssetDetails
    walletType="keystore"
    walletAddress="bnb-address"
    txsPageRD={RD.initial}
    balances={getBalances([runeBnbBalance, bnbBalanceEmpty])}
    asset={AssetRune67C}
    network={Network.Testnet}
    openExplorerTxUrl={openExplorerTxUrl}
    disableSend={false}
  />
)
StoryRuneFeeNotCovered.storyName = 'RUNE - fee not covered'

export default {
  title: 'Wallet/AssetsDetails'
}
