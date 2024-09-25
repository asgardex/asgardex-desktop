import { Network } from '@xchainjs/xchain-client'
import { Address, AnyAsset, AssetType, Chain, AssetAmount, baseToAsset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { IntlShape } from 'react-intl'

import { Dex } from '../../shared/api/types'
import { optionFromNullableString } from '../../shared/utils/fp'
import { isLedgerWallet, isWalletType } from '../../shared/utils/guard'
import { WalletAddress, WalletType } from '../../shared/wallet/types'
import { ZERO_ASSET_AMOUNT } from '../const'
import { WalletBalances } from '../services/clients'
import { NonEmptyWalletBalances, WalletBalance } from '../services/wallet/types'
import { isLtcAsset, isRuneNativeAsset, isMayaAsset } from './assetHelper'
import {
  isArbChain,
  isBchChain,
  isDashChain,
  isDogeChain,
  isLtcChain,
  isMayaChain,
  isThorChain,
  isXrdChain
} from './chainHelper'
import { eqAddress, eqAsset, eqChain, eqWalletType } from './fp/eq'

/**
 * Tries to find an `AssetAmount` of an `Asset`
 * in a given list of `Balance`
 *
 * Note: Returns `None` if `Asset` has not been found this list.
 * */
export const getAssetAmountByAsset = (balances: WalletBalances, assetToFind: AnyAsset): O.Option<AssetAmount> =>
  FP.pipe(
    balances,
    A.findFirst(({ asset }) => eqAsset.equals(asset, assetToFind)),
    O.map((walletBalance) => baseToAsset(walletBalance.amount))
  )

export const getWalletBalanceByAsset = (
  oWalletBalances: O.Option<NonEmptyWalletBalances>,
  asset: AnyAsset
): O.Option<WalletBalance> =>
  FP.pipe(
    oWalletBalances,
    O.chain((walletBalances) =>
      FP.pipe(
        walletBalances,
        A.findFirst(({ asset: assetInList }) => eqAsset.equals(assetInList, asset))
      )
    )
  )

export const getWalletBalanceByAssetAndWalletType = ({
  oWalletBalances,
  asset,
  walletType
}: {
  oWalletBalances: O.Option<NonEmptyWalletBalances>
  asset: AnyAsset
  walletType: WalletType
}): O.Option<WalletBalance> =>
  FP.pipe(
    oWalletBalances,
    O.chain((walletBalances) =>
      FP.pipe(
        walletBalances,
        A.findFirst(
          ({ asset: assetInList, walletType: balanceWalletType }) =>
            eqAsset.equals(assetInList, asset) && eqWalletType.equals(walletType, balanceWalletType)
        )
      )
    )
  )

export const getWalletBalanceByAddress = (
  balances: NonEmptyWalletBalances,
  address: Address
): O.Option<WalletBalance> =>
  FP.pipe(
    balances,
    A.findFirst(({ walletAddress: addressInList }) => eqAddress.equals(addressInList, address))
  )

export const getWalletBalanceByAddressAndAsset = ({
  balances,
  address,
  asset
}: {
  balances: NonEmptyWalletBalances
  address: Address
  asset: AnyAsset
}): O.Option<WalletBalance> =>
  FP.pipe(
    balances,
    A.findFirst(
      ({ walletAddress: addressInList, asset: assetInList }) =>
        eqAddress.equals(addressInList, address) &&
        eqAddress.equals(assetInList.symbol, asset.symbol) &&
        eqChain.equals(assetInList.chain, asset.chain)
    )
  )

export const getWalletAssetAmountFromBalances =
  (isTargetWalletBalance: (wb: WalletBalance) => boolean) =>
  (balances: WalletBalances): O.Option<AssetAmount> =>
    FP.pipe(
      balances,
      A.findFirst(isTargetWalletBalance),
      O.map(({ amount }) => baseToAsset(amount)),
      O.alt(() => O.some(ZERO_ASSET_AMOUNT))
    )

// TODO (@asgdx-team) Add tests
export const hasLedgerInBalancesByAsset = (asset: AnyAsset, balances: WalletBalances): boolean =>
  FP.pipe(
    balances,
    A.findFirst(
      ({ walletType, asset: balanceAsset }) => eqAsset.equals(asset, balanceAsset) && isLedgerWallet(walletType)
    ),
    O.fold(
      () => false,
      () => true
    )
  )

export const getAssetAmountFromBalances = (
  balances: WalletBalances,
  isAsset: (asset: AnyAsset) => boolean
): O.Option<AssetAmount> =>
  FP.pipe(
    balances,
    A.findFirst(({ asset }) => {
      return isAsset(asset)
    }),
    O.map(({ amount }) => baseToAsset(amount))
  )

export const getEVMAmountFromBalances = (balances: WalletBalances, assetToFind: AnyAsset): O.Option<AssetAmount> =>
  getAssetAmountFromBalances(balances, (asset) => asset === assetToFind)

export const getLtcAmountFromBalances = (balances: WalletBalances): O.Option<AssetAmount> =>
  getAssetAmountFromBalances(balances, isLtcAsset)

export const getRuneNativeAmountFromBalances = (balances: WalletBalances): O.Option<AssetAmount> =>
  getAssetAmountFromBalances(balances, isRuneNativeAsset)

export const getCacaoAmountFromBalances = (balances: WalletBalances, assetToFind: AnyAsset): O.Option<AssetAmount> =>
  getAssetAmountFromBalances(balances, (asset) => asset === assetToFind)
export const getMayaAmountFromBalances = (balances: WalletBalances): O.Option<AssetAmount> =>
  getAssetAmountFromBalances(balances, isMayaAsset)

export const filterWalletBalancesByAssets = (balances: NonEmptyWalletBalances, assets: AnyAsset[]): WalletBalances => {
  return balances.filter((balance) => {
    const assetIndex = assets.findIndex(
      (asset) =>
        asset.chain === balance.asset.chain &&
        asset.symbol.toUpperCase() === balance.asset.symbol.toUpperCase() && // Convert to uppercase for comparison
        asset.ticker === balance.asset.ticker
    )
    return assetIndex >= 0
  })
}
export const filterWalletBalancesByAssetsForDex = (
  balances: NonEmptyWalletBalances,
  assets: AnyAsset[],
  dex: Dex
): WalletBalances => {
  return balances.filter((balance) => {
    // Check if the balance is a synthetic asset and filter based on dex

    const walletAddressPrefix = balance.walletAddress.substring(0, 4).toUpperCase()
    if (dex.chain !== walletAddressPrefix && balance.asset.type === AssetType.SYNTH) {
      return false
    }

    const assetIndex = assets.findIndex(
      (asset) =>
        asset.chain.toUpperCase() === balance.asset.chain.toUpperCase() &&
        asset.symbol.toUpperCase() === balance.asset.symbol.toUpperCase() &&
        asset.ticker.toUpperCase() === balance.asset.ticker.toUpperCase()
    )
    return assetIndex >= 0
  })
}

export const addressFromWalletAddress = ({ address }: Pick<WalletAddress, 'address'>): Address => address

export const addressFromOptionalWalletAddress = (
  oWalletAddress: O.Option<Pick<WalletAddress, 'address'>>
): O.Option<Address> => FP.pipe(oWalletAddress, O.map(addressFromWalletAddress))

export const getWalletByAddress = (walletBalances: WalletBalances, address: Address): O.Option<WalletBalance> =>
  FP.pipe(
    walletBalances,
    A.findFirst(({ walletAddress }) => eqAddress.equals(walletAddress, address))
  )

export const isEnabledLedger = (chain: Chain, network: Network) => {
  // Disable THORChain ledger wallets in stagenet
  if (isThorChain(chain) && network === Network.Stagenet) return false
  // Disable LTC ledger wallets in testnet
  // It seems Ledger can not derive LTC addresses on Testnet properly
  if (isLtcChain(chain) && network === Network.Testnet) return false
  // Same for BCH - no Ledger support for `testnet`
  if (isBchChain(chain) && network === Network.Testnet) return false
  // No DOGE support on `testnet`
  if (isDogeChain(chain) && network === Network.Testnet) return false
  // No DASH support on `testnet`
  if (isDashChain(chain) && network === Network.Testnet) return false
  // No DASH support on `testnet`
  if (isArbChain(chain)) return false
  // Disable for these chains
  if (isMayaChain(chain)) return false
  if (isXrdChain(chain)) return false
  return true
}

export const getWalletAddressFromNullableString = (s?: string): O.Option<Address> =>
  FP.pipe(s, optionFromNullableString, O.chain(O.fromPredicate((s) => s.length > 0)))

// TODO (@veado) Use `naturalNumberFromNullableString` from `shared/utils/fp`
export const getWalletIndexFromNullableString = (s?: string): O.Option<number /* positive integer */> =>
  FP.pipe(s, optionFromNullableString, O.map(parseInt), O.chain(O.fromPredicate((v) => !isNaN(v) && v >= 0)))

export const getWalletTypeFromNullableString = (s?: string): O.Option<WalletType> =>
  FP.pipe(s, optionFromNullableString, O.chain(O.fromPredicate(isWalletType)))

export const getWalletNamesFromKeystoreWallets = (wallets: Array<Required<{ name: string }>>) =>
  FP.pipe(
    wallets,
    A.map(({ name }) => name)
  )

export const getWalletTypeLabel = (oWalletType: O.Option<WalletType>, intl: IntlShape) => {
  const id = FP.pipe(
    oWalletType,
    O.map((walletType) => {
      switch (walletType) {
        case 'keystore':
          return 'common.keystore'
        case 'ledger':
          return 'common.ledger'
        default:
          return 'common.custom'
      }
    }),
    O.getOrElse(() => 'common.custom')
  )
  return intl.formatMessage({ id })
}
