import { BNBChain } from '@xchainjs/xchain-binance'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { Network } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { assetToBase, assetAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/lib/Option'

import { ASSETS_TESTNET } from '../../shared/mock/assets'
import { AssetBNB, AssetLTC, AssetRuneNative } from '../../shared/utils/asset'
import { AssetBUSD74E } from '../const'
import { NonEmptyWalletBalances, WalletBalance, WalletBalances } from '../services/wallet/types'
import { isRuneNativeAsset } from './assetHelper'
import { eqWalletBalances } from './fp/eq'
import { mockWalletBalance } from './test/testWalletHelper'
import {
  filterWalletBalancesByAssets,
  getAssetAmountByAsset,
  getBnbAmountFromBalances,
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
  const RUNE_WB = mockWalletBalance({ amount: assetToBase(assetAmount(1)), walletAddress: 'thor-address' })
  const RUNE_LEDGER_WB = mockWalletBalance({
    amount: assetToBase(assetAmount(2)),
    walletAddress: 'thor-ledger-address',
    walletType: 'ledger'
  })
  const BOLT_WB = mockWalletBalance({
    amount: assetToBase(assetAmount(3)),
    walletAddress: 'bolt-address',
    asset: ASSETS_TESTNET.BOLT
  })
  const BNB_WB: WalletBalance = mockWalletBalance({
    amount: assetToBase(assetAmount(4)),
    walletAddress: 'bnb-address',
    asset: AssetBNB
  })
  const BUSD_WB: WalletBalance = mockWalletBalance({
    amount: assetToBase(assetAmount(4.1)),
    walletAddress: 'busd-address',
    asset: AssetBUSD74E
  })
  const BUSD_LEDGER_WB: WalletBalance = mockWalletBalance({
    amount: assetToBase(assetAmount(4.2)),
    walletAddress: 'busd-ledger-address',
    asset: AssetBUSD74E,
    walletType: 'ledger'
  })
  const LTC_WB = mockWalletBalance({
    amount: assetToBase(assetAmount(5)),
    asset: AssetLTC
  })

  describe('amountByAsset', () => {
    it('returns amount of RUNE', () => {
      const result = getAssetAmountByAsset([RUNE_WB, BOLT_WB, BNB_WB], AssetRuneNative)
      expect(
        FP.pipe(
          result,
          O.map((a) => a.amount().toString()),
          O.getOrElse(() => '')
        )
      ).toEqual('1')
    })
    it('returns None for an unknown asset', () => {
      const result = getAssetAmountByAsset([RUNE_WB, BNB_WB], ASSETS_TESTNET.FTM)
      expect(result).toBeNone()
    })
    it('returns None for an empty list of assets', () => {
      const result = getAssetAmountByAsset([], ASSETS_TESTNET.FTM)
      expect(result).toBeNone()
    })
  })

  describe('getWalletBalanceByAsset', () => {
    it('returns amount of BNB', () => {
      const balances: O.Option<NonEmptyWalletBalances> = NEA.fromArray([RUNE_WB, BOLT_WB, BNB_WB])
      const result = O.toNullable(getWalletBalanceByAsset(balances, AssetBNB))
      expect(result?.asset.symbol).toEqual('BNB')
      expect(result?.amount.amount().toString()).toEqual('400000000')
    })
    it('returns none if BNB is not available', () => {
      const balances: O.Option<NonEmptyWalletBalances> = NEA.fromArray([RUNE_WB, BOLT_WB])
      const result = getWalletBalanceByAsset(balances, AssetBNB)
      expect(result).toBeNone()
    })
    it('returns none for empty lists of `AssetWB`', () => {
      const balances: O.Option<NonEmptyWalletBalances> = NEA.fromArray([])
      const result = getWalletBalanceByAsset(balances, AssetBNB)
      expect(result).toBeNone()
    })
  })

  describe('getBnbAmountFromBalances', () => {
    it('returns amount of BNB', () => {
      const result = getBnbAmountFromBalances([RUNE_WB, BOLT_WB, BNB_WB])
      expect(
        FP.pipe(
          result,
          // Check transformation from `BaseAmount` to `AssetAmount`
          O.map((a) => a.amount().isEqualTo(4)),
          O.getOrElse(() => false)
        )
      ).toBeTruthy()
    })
    it('returns none if no BNB is available', () => {
      const result = getBnbAmountFromBalances([RUNE_WB, BOLT_WB])
      expect(result).toBeNone()
    })
  })

  describe('getLtcAmountFromBalances', () => {
    it('returns amount of LTC', () => {
      const result = getLtcAmountFromBalances([RUNE_WB, BOLT_WB, BNB_WB, LTC_WB])
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
      const result = getLtcAmountFromBalances([RUNE_WB, BOLT_WB])
      expect(result).toBeNone()
    })
  })

  describe('filterWalletBalancesByAssets', () => {
    it('filters misc. assets', () => {
      const result = filterWalletBalancesByAssets(
        [RUNE_WB, RUNE_LEDGER_WB, BOLT_WB, BNB_WB, LTC_WB, BUSD_LEDGER_WB, BUSD_WB],
        [AssetBNB, AssetLTC, AssetBUSD74E]
      )
      expect(eqWalletBalances.equals(result, [BNB_WB, LTC_WB, BUSD_LEDGER_WB, BUSD_WB])).toBeTruthy()
    })

    it('filters rune keystore + ledger', () => {
      const result = filterWalletBalancesByAssets([RUNE_WB, RUNE_LEDGER_WB, BOLT_WB, BNB_WB, LTC_WB], [AssetRuneNative])
      expect(eqWalletBalances.equals(result, [RUNE_WB, RUNE_LEDGER_WB])).toBeTruthy()
    })
    it('returns empty array if no asset is available', () => {
      const result = filterWalletBalancesByAssets([RUNE_WB, BOLT_WB], [AssetLTC])
      expect(eqWalletBalances.equals(result, [])).toBeTruthy()
    })
  })

  describe('getWalletByAddress', () => {
    it('returns address of RUNE wallet', () => {
      const balances: WalletBalances = NEA.fromReadonlyNonEmptyArray([RUNE_WB, BOLT_WB, BNB_WB])
      const result = O.toNullable(getWalletByAddress(balances, RUNE_WB.walletAddress))
      expect(isRuneNativeAsset(result?.asset ?? AssetBNB /* BNB would fail */)).toBeTruthy()
      expect(result?.walletAddress).toEqual(RUNE_WB.walletAddress)
    })
    it('returns none if BNB wallet address is not available', () => {
      const balances: WalletBalances = NEA.fromReadonlyNonEmptyArray([BOLT_WB, BNB_WB])
      const result = getWalletByAddress(balances, RUNE_WB.walletAddress)
      expect(result).toBeNone()
    })
  })

  describe('hasLedgerInBalancesByAsset', () => {
    it('RUNE -> true ', () => {
      const balances: WalletBalances = NEA.fromReadonlyNonEmptyArray([RUNE_WB, RUNE_LEDGER_WB, BOLT_WB, BNB_WB])
      const result = hasLedgerInBalancesByAsset(AssetRuneNative, balances)
      expect(result).toBeTruthy()
    })
    it('RUNE -> false', () => {
      const balances: WalletBalances = NEA.fromReadonlyNonEmptyArray([RUNE_WB, BOLT_WB, BNB_WB])
      const result = hasLedgerInBalancesByAsset(AssetRuneNative, balances)
      expect(result).toBeFalsy()
    })
    it('BUSD -> true', () => {
      const balances: WalletBalances = NEA.fromReadonlyNonEmptyArray([RUNE_WB, BUSD_LEDGER_WB, BUSD_WB, BNB_WB])
      const result = hasLedgerInBalancesByAsset(AssetBUSD74E, balances)
      expect(result).toBeTruthy()
    })
    it('BUSD -> false', () => {
      const balances: WalletBalances = NEA.fromReadonlyNonEmptyArray([RUNE_WB, BUSD_WB, BNB_WB])
      const result = hasLedgerInBalancesByAsset(AssetBUSD74E, balances)
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
    it('BNB ledger -> true', () => {
      expect(isEnabledLedger(BNBChain, Network.Mainnet)).toBeTruthy()
      expect(isEnabledLedger(BNBChain, Network.Testnet)).toBeTruthy()
      expect(isEnabledLedger(BNBChain, Network.Stagenet)).toBeTruthy()
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
