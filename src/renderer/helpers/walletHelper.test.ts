import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { assetToBase, assetAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/lib/Option'

import { ASSETS_MAINNET } from '../../shared/mock/assets'
import { AssetBSC, AssetLTC, AssetRuneNative } from '../../shared/utils/asset'
import { AssetUSDCBSC } from '../const'
import { NonEmptyWalletBalances, WalletBalance, WalletBalances } from '../services/wallet/types'
import { eqWalletBalances } from './fp/eq'
import { mockWalletBalance } from './test/testWalletHelper'
import {
  filterWalletBalancesByAssets,
  getAssetAmountByAsset,
  getEVMAmountFromBalances,
  getLtcAmountFromBalances,
  getWalletAddressFromNullableString,
  getWalletBalanceByAsset,
  getWalletByAddress,
  getWalletIndexFromNullableString,
  getWalletTypeFromNullableString,
  hasLedgerInBalancesByAsset,
  isEnabledLedger
} from './walletHelper'

describe('walletHelper', () => {
  const RUNE_WB = mockWalletBalance({
    amount: assetToBase(assetAmount(1)),
    walletAddress: 'thor-address',
    asset: AssetRuneNative
  })
  const RUNE_LEDGER_WB = mockWalletBalance({
    amount: assetToBase(assetAmount(2)),
    walletAddress: 'thor-ledger-address',
    walletType: 'ledger',
    asset: AssetRuneNative
  })
  const DOGE_WB = mockWalletBalance({
    amount: assetToBase(assetAmount(3)),
    walletAddress: 'doge-address',
    asset: ASSETS_MAINNET.DOGE
  })
  const BSC_WB: WalletBalance = mockWalletBalance({
    amount: assetToBase(assetAmount(4)),
    walletAddress: 'bsc-address',
    asset: AssetBSC
  })
  const USDC_WB: WalletBalance = mockWalletBalance({
    amount: assetToBase(assetAmount(4.1)),
    walletAddress: 'usdt-address',
    asset: AssetUSDCBSC
  })
  const USDC_LEDGER_WB: WalletBalance = mockWalletBalance({
    amount: assetToBase(assetAmount(4.2)),
    walletAddress: 'usdt-ledger-address',
    asset: AssetUSDCBSC,
    walletType: 'ledger'
  })
  const LTC_WB = mockWalletBalance({
    amount: assetToBase(assetAmount(5)),
    asset: AssetLTC
  })

  describe('amountByAsset', () => {
    it('returns amount of RUNE', () => {
      const result = getAssetAmountByAsset([RUNE_WB, DOGE_WB, BSC_WB], AssetRuneNative)
      expect(
        FP.pipe(
          result,
          O.map((a) => a.amount().toString()),
          O.getOrElse(() => '')
        )
      ).toEqual('1')
    })
    it('returns None for an unknown asset', () => {
      const result = getAssetAmountByAsset([RUNE_WB, BSC_WB], ASSETS_MAINNET.BTC)
      expect(result).toBeNone()
    })
    it('returns None for an empty list of assets', () => {
      const result = getAssetAmountByAsset([], ASSETS_MAINNET.BTC)
      expect(result).toBeNone()
    })
  })

  describe('getWalletBalanceByAsset', () => {
    it('returns amount of BSC', () => {
      const balances: O.Option<NonEmptyWalletBalances> = NEA.fromArray([RUNE_WB, DOGE_WB, BSC_WB])
      const result = O.toNullable(getWalletBalanceByAsset(balances, AssetBSC))
      expect(result?.asset.symbol).toEqual('BNB')
      expect(result?.amount.amount().toString()).toEqual('400000000')
    })
    it('returns none if BSC is not available', () => {
      const balances: O.Option<NonEmptyWalletBalances> = NEA.fromArray([RUNE_WB, DOGE_WB])
      const result = getWalletBalanceByAsset(balances, AssetBSC)
      expect(result).toBeNone()
    })
    it('returns none for empty lists of `AssetWB`', () => {
      const balances: O.Option<NonEmptyWalletBalances> = NEA.fromArray([])
      const result = getWalletBalanceByAsset(balances, AssetBSC)
      expect(result).toBeNone()
    })
  })

  describe('getBscAmountFromBalances', () => {
    it('returns amount of BSC', () => {
      const result = getEVMAmountFromBalances([BSC_WB], AssetBSC)
      expect(
        FP.pipe(
          result,
          // Check transformation from `BaseAmount` to `AssetAmount`
          O.map((a) => a.amount().isEqualTo(4)),
          O.getOrElse(() => false)
        )
      ).toBeTruthy()
    })
    it('returns none if no BSC is available', () => {
      const result = getEVMAmountFromBalances([RUNE_WB], AssetBSC)
      expect(result).toBeNone()
    })
  })

  describe('getLtcAmountFromBalances', () => {
    it('returns amount of LTC', () => {
      const result = getLtcAmountFromBalances([RUNE_WB, DOGE_WB, BSC_WB, LTC_WB])
      expect(
        FP.pipe(
          result,
          // Check transformation from `BaseAmount` to `AssetAmount`
          O.map((a) => a.amount().isEqualTo('5')),
          O.getOrElse(() => false)
        )
      ).toBeTruthy()
    })
    it('returns none if no LTC is available', () => {
      const result = getLtcAmountFromBalances([RUNE_WB, DOGE_WB])
      expect(result).toBeNone()
    })
  })

  describe('filterWalletBalancesByAssets', () => {
    it('filters misc. assets', () => {
      const result = filterWalletBalancesByAssets(
        [RUNE_WB, RUNE_LEDGER_WB, DOGE_WB, BSC_WB, LTC_WB, USDC_LEDGER_WB, USDC_WB],
        [AssetBSC, AssetLTC, AssetUSDCBSC]
      )
      expect(eqWalletBalances.equals(result, [BSC_WB, LTC_WB, USDC_LEDGER_WB, USDC_WB])).toBeTruthy()
    })

    it('filters rune keystore + ledger', () => {
      const result = filterWalletBalancesByAssets([RUNE_WB, RUNE_LEDGER_WB, DOGE_WB, BSC_WB, LTC_WB], [AssetRuneNative])
      expect(eqWalletBalances.equals(result, [RUNE_WB, RUNE_LEDGER_WB])).toBeTruthy()
    })
    it('returns empty array if no asset is available', () => {
      const result = filterWalletBalancesByAssets([RUNE_WB, DOGE_WB], [AssetLTC])
      expect(eqWalletBalances.equals(result, [])).toBeTruthy()
    })
  })

  describe('getWalletByAddress', () => {
    it('returns none if BSC.BNB wallet address is not available', () => {
      const balances: WalletBalances = NEA.fromReadonlyNonEmptyArray([DOGE_WB, BSC_WB])
      const result = getWalletByAddress(balances, RUNE_WB.walletAddress)
      expect(result).toBeNone()
    })
  })

  describe('hasLedgerInBalancesByAsset', () => {
    it('RUNE -> true ', () => {
      const balances: WalletBalances = NEA.fromReadonlyNonEmptyArray([RUNE_WB, RUNE_LEDGER_WB, DOGE_WB, BSC_WB])
      const result = hasLedgerInBalancesByAsset(AssetRuneNative, balances)
      expect(result).toBeTruthy()
    })
    it('RUNE -> false', () => {
      const balances: WalletBalances = NEA.fromReadonlyNonEmptyArray([RUNE_WB, DOGE_WB, BSC_WB])
      const result = hasLedgerInBalancesByAsset(AssetRuneNative, balances)
      expect(result).toBeFalsy()
    })
    it('USDC -> true', () => {
      const balances: WalletBalances = NEA.fromReadonlyNonEmptyArray([RUNE_WB, USDC_LEDGER_WB, USDC_WB, BSC_WB])
      const result = hasLedgerInBalancesByAsset(AssetUSDCBSC, balances)
      expect(result).toBeTruthy()
    })
    it('USDC -> false', () => {
      const balances: WalletBalances = NEA.fromReadonlyNonEmptyArray([RUNE_WB, USDC_WB, BSC_WB])
      const result = hasLedgerInBalancesByAsset(AssetUSDCBSC, balances)
      expect(result).toBeFalsy()
    })
  })

  describe('isEnabledLedger', () => {
    it('THOR ledger stagenet -> false', () => {
      expect(isEnabledLedger(THORChain, Network.Stagenet)).toBeFalsy()
    })
    it('THOR ledger mainnet/testnet -> true', () => {
      expect(isEnabledLedger(THORChain, Network.Mainnet)).toBeTruthy()
      expect(isEnabledLedger(THORChain, Network.Testnet)).toBeTruthy()
    })
    it('LTC ledger testnet -> false', () => {
      expect(isEnabledLedger(LTCChain, Network.Testnet)).toBeFalsy()
    })
    it('LTC ledger mainnet/stagenet -> true', () => {
      expect(isEnabledLedger(LTCChain, Network.Mainnet)).toBeTruthy()
      expect(isEnabledLedger(LTCChain, Network.Stagenet)).toBeTruthy()
    })
    it('BCH ledger testnet -> false', () => {
      expect(isEnabledLedger(BCHChain, Network.Testnet)).toBeFalsy()
    })
    it('BCH ledger mainnet/stagenet -> true', () => {
      expect(isEnabledLedger(BCHChain, Network.Mainnet)).toBeTruthy()
      expect(isEnabledLedger(BCHChain, Network.Stagenet)).toBeTruthy()
    })
    it('BTC ledger -> true', () => {
      expect(isEnabledLedger(BTCChain, Network.Mainnet)).toBeTruthy()
      expect(isEnabledLedger(BTCChain, Network.Testnet)).toBeTruthy()
      expect(isEnabledLedger(BTCChain, Network.Stagenet)).toBeTruthy()
    })
    it('BSC ledger -> true', () => {
      expect(isEnabledLedger(BSCChain, Network.Mainnet)).toBeTruthy()
      expect(isEnabledLedger(BSCChain, Network.Testnet)).toBeTruthy()
      expect(isEnabledLedger(BSCChain, Network.Stagenet)).toBeTruthy()
    })
    it('DOGE ledger testnet - false', () => {
      expect(isEnabledLedger(DOGEChain, Network.Testnet)).toBeFalsy()
    })
    it('DOGE ledger mainnet/stagenet -> true', () => {
      expect(isEnabledLedger(DOGEChain, Network.Mainnet)).toBeTruthy()
      expect(isEnabledLedger(DOGEChain, Network.Stagenet)).toBeTruthy()
    })

    it('Cosmos ledger mainnet/stagenet/testnet -> true', () => {
      expect(isEnabledLedger(GAIAChain, Network.Testnet)).toBeTruthy()
      expect(isEnabledLedger(GAIAChain, Network.Mainnet)).toBeTruthy()
      expect(isEnabledLedger(GAIAChain, Network.Stagenet)).toBeTruthy()
    })
  })

  describe('getWalletAddressFromNullableString', () => {
    it('address string', () => {
      const result = getWalletAddressFromNullableString('any-address')
      expect(result).toEqual(O.some('any-address'))
    })
    it('empty string', () => {
      const result = getWalletAddressFromNullableString('')
      expect(result).toBeNone()
    })
    it('undefined', () => {
      const result = getWalletAddressFromNullableString()
      expect(result).toBeNone()
    })
  })

  describe('getWalletIndexFromNullableString', () => {
    it('integer', () => {
      const result = getWalletIndexFromNullableString('1')
      expect(result).toEqual(O.some(1))
    })
    it('-1', () => {
      const result = getWalletIndexFromNullableString('-1')
      expect(result).toBeNone()
    })
    it('undefined', () => {
      const result = getWalletIndexFromNullableString()
      expect(result).toBeNone()
    })
  })

  describe('getWalletTypeFromNullableString', () => {
    it('keystore', () => {
      const result = getWalletTypeFromNullableString('keystore')
      expect(result).toEqual(O.some('keystore'))
    })
    it('invalid', () => {
      const result = getWalletTypeFromNullableString('invalid')
      expect(result).toBeNone()
    })
    it('undefined', () => {
      const result = getWalletTypeFromNullableString()
      expect(result).toBeNone()
    })
  })
})
