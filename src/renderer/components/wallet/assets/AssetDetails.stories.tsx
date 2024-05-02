import * as RD from '@devexperts/remote-data-ts'
import { Meta, StoryObj } from '@storybook/react'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'
import * as NEA from 'fp-ts/lib/NonEmptyArray'

import { AssetBSC, AssetRuneNative } from '../../../../shared/utils/asset'
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

const bscBalance: WalletBalance = mockWalletBalance({
  asset: AssetBSC,
  amount: assetToBase(assetAmount(1.1)),
  walletAddress: 'BSC address'
})

const runeBalance: WalletBalance = mockWalletBalance({
  asset: AssetRuneNative,
  amount: assetToBase(assetAmount(2.2)),
  walletAddress: 'thor.Rune address'
})

const runeNativeBalance: WalletBalance = mockWalletBalance()

const runeBalanceEmpty: WalletBalance = { ...runeBalance, amount: ZERO_BASE_AMOUNT }
const bscBalanceEmpty: WalletBalance = { ...bscBalance, amount: ZERO_BASE_AMOUNT }
const getBalances = (balances: WalletBalances) => NEA.fromArray<WalletBalance>(balances)
const balances = getBalances([bscBalance, runeBalance, runeNativeBalance])
const openExplorerTxUrl: OpenExplorerTxUrl = (txHash: TxHash) => {
  console.log(`Open explorer - tx hash ${txHash}`)
  return Promise.resolve(true)
}

// Example conversion for the StoryBNB story
export const StoryBSC: StoryObj<AssetDetailsProps> = {
  render: () => (
    <AssetDetails
      walletType="keystore"
      walletAddress="bnb-address"
      txsPageRD={RD.initial}
      balances={balances}
      asset={AssetBSC}
      network={Network.Testnet}
      openExplorerTxUrl={openExplorerTxUrl}
      disableSend={false}
      dex={'THOR'}
      haltedChains={[]}
      changeDex={changeDex}
    />
  ),
  name: 'BSC'
}
export const StoryRuneTxSuccess: StoryObj<AssetDetailsProps> = {
  render: () => (
    <AssetDetails
      walletType="keystore"
      walletAddress="thor-address"
      txsPageRD={RD.initial}
      balances={balances}
      asset={AssetRuneNative}
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
      asset={AssetRuneNative}
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
      walletAddress="thor-address"
      txsPageRD={RD.initial}
      balances={balances}
      asset={AssetRuneNative}
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
      walletAddress="thor-address"
      txsPageRD={RD.initial}
      balances={getBalances([runeBalanceEmpty, bscBalance])}
      asset={AssetRuneNative}
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
      balances={getBalances([runeBalance, bscBalanceEmpty])}
      asset={AssetRuneNative}
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
