import * as RD from '@devexperts/remote-data-ts'
import { Meta, StoryObj } from '@storybook/react'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'
import * as NEA from 'fp-ts/lib/NonEmptyArray'

import { AssetBNB, AssetRune67C } from '../../../../shared/utils/asset'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { mockWalletBalance } from '../../../helpers/test/testWalletHelper'
import { changeDex } from '../../../services/app/service'
import { OpenExplorerTxUrl } from '../../../services/clients'
import { WalletBalance, WalletBalances } from '../../../services/wallet/types'
import { AssetDetails, Props as AssetDetailsProps } from './AssetDetails'

const meta: Meta<AssetDetailsProps> = {
  title: 'Wallet/AssetDetails',
  component: AssetDetails
}

export default meta

// Define other stories following the same pattern

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

// Example conversion for the StoryBNB story
export const StoryBNB: StoryObj<AssetDetailsProps> = {
  render: () => (
    <AssetDetails
      walletType="keystore"
      walletAddress="bnb-address"
      txsPageRD={RD.initial}
      balances={balances}
      asset={AssetBNB}
      network={Network.Testnet}
      openExplorerTxUrl={openExplorerTxUrl}
      disableSend={false}
      dex={'THOR'}
      haltedChains={[]}
      changeDex={changeDex}
    />
  ),
  name: 'BNB'
}
export const StoryRuneTxSuccess: StoryObj<AssetDetailsProps> = {
  render: () => (
    <AssetDetails
      walletType="keystore"
      walletAddress="thor-address"
      txsPageRD={RD.initial}
      balances={balances}
      asset={AssetRune67C}
      network={Network.Testnet}
      openExplorerTxUrl={openExplorerTxUrl}
      disableSend={false}
      dex={'THOR'}
      haltedChains={[]}
      changeDex={changeDex}
    />
  ),
  name: 'RUNE - tx success'
}

export const StoryRuneNoSend: StoryObj<AssetDetailsProps> = {
  render: () => (
    <AssetDetails
      walletType="keystore"
      walletAddress="thor-address"
      txsPageRD={RD.initial}
      balances={balances}
      asset={AssetRune67C}
      network={Network.Testnet}
      openExplorerTxUrl={openExplorerTxUrl}
      disableSend={true}
      dex={'THOR'}
      haltedChains={[]}
      changeDex={changeDex}
    />
  ),
  name: 'RUNE - no send'
}

export const StoryRuneTxError: StoryObj<AssetDetailsProps> = {
  render: () => (
    <AssetDetails
      walletType="keystore"
      walletAddress="bnb-address"
      txsPageRD={RD.initial}
      balances={balances}
      asset={AssetRune67C}
      network={Network.Testnet}
      openExplorerTxUrl={openExplorerTxUrl}
      disableSend={false}
      dex={'THOR'}
      haltedChains={[]}
      changeDex={changeDex}
    />
  ),
  name: 'RUNE - tx error'
}

export const StoryRuneNoBalances: StoryObj<AssetDetailsProps> = {
  render: () => (
    <AssetDetails
      walletType="keystore"
      walletAddress="bnb-address"
      txsPageRD={RD.initial}
      balances={getBalances([runeBalanceEmpty, bnbBalance])}
      asset={AssetRune67C}
      network={Network.Testnet}
      openExplorerTxUrl={openExplorerTxUrl}
      disableSend={false}
      dex={'THOR'}
      haltedChains={[]}
      changeDex={changeDex}
    />
  ),
  name: 'RUNE - disabled - no balance'
}

export const StoryRuneFeeNotCovered: StoryObj<AssetDetailsProps> = {
  render: () => (
    <AssetDetails
      walletType="keystore"
      walletAddress="bnb-address"
      txsPageRD={RD.initial}
      balances={getBalances([runeBnbBalance, bnbBalanceEmpty])}
      asset={AssetRune67C}
      network={Network.Testnet}
      openExplorerTxUrl={openExplorerTxUrl}
      disableSend={false}
      dex={'THOR'}
      haltedChains={[]}
      changeDex={changeDex}
    />
  ),
  name: 'RUNE - fee not covered'
}
