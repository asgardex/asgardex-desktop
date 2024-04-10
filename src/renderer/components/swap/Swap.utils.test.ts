import { BTCChain, BTC_DECIMAL } from '@xchainjs/xchain-bitcoin'
import { BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { ETH_GAS_ASSET_DECIMAL as ETH_DECIMAL } from '@xchainjs/xchain-ethereum'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { assetAmount, assetToBase, baseAmount, bn } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'

import { ASSETS_TESTNET } from '../../../shared/mock/assets'
import { AssetBTC, AssetETH, AssetRuneNative, AssetBSC } from '../../../shared/utils/asset'
import { AssetUSDCBSC, AssetUSDT62E, AssetUSDTBSC, AssetUSDTERC20Testnet } from '../../const'
import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { eqAsset, eqBaseAmount } from '../../helpers/fp/eq'
import { mockWalletBalance } from '../../helpers/test/testWalletHelper'
import { PoolsDataMap } from '../../services/midgard/types'
import {
  isRuneSwap,
  pickPoolAsset,
  calcRefundFee,
  minAmountToSwapMax1e8,
  maxAmountToSwapMax1e8,
  assetsInWallet,
  balancesToSwapFrom,
  hasLedgerInBalancesByChain
} from './Swap.utils'

describe('components/swap/utils', () => {
  describe('isRuneSwap', () => {
    it('should return none if no RUNE asset', () => {
      expect(isRuneSwap(ASSETS_TESTNET.BOLT, AssetBSC)).toBeNone()
    })

    it('should return some(true) if target asset is RUNE', () => {
      expect(isRuneSwap(ASSETS_TESTNET.BOLT, AssetRuneNative)).toEqual(O.some(true))
    })

    it('should return some(false) if source asset is RUNE', () => {
      expect(isRuneSwap(AssetRuneNative, ASSETS_TESTNET.BOLT)).toEqual(O.some(false))
    })
  })

  describe('pickPoolAsset', () => {
    it('should be none', () => {
      expect(pickPoolAsset([], AssetBSC)).toBeNone()
    })
    it('should return first element if nothing found', () => {
      expect(
        pickPoolAsset(
          [
            { asset: AssetRuneNative, assetPrice: bn(0) },
            { asset: AssetBSC, assetPrice: bn(1) }
          ],
          ASSETS_TESTNET.FTM
        )
      ).toEqual(O.some({ asset: AssetRuneNative, assetPrice: bn(0) }))
    })

    it('should pick asset', () => {
      expect(
        pickPoolAsset(
          [
            { asset: AssetRuneNative, assetPrice: bn(0) },
            { asset: AssetBSC, assetPrice: bn(1) },
            { asset: AssetETH, assetPrice: bn(2) }
          ],
          AssetETH
        )
      ).toEqual(O.some({ asset: AssetETH, assetPrice: bn(2) }))
    })
  })

  describe('calcRefundFee', () => {
    it('should be 3 x inbound fee', () => {
      const result = calcRefundFee(baseAmount(2))
      expect(eqBaseAmount.equals(result, baseAmount(6))).toBeTruthy()
    })
  })

  describe('minAmountToSwapMax1e8', () => {
    const poolsData: PoolsDataMap = {
      'BNB.BUSD-74E': {
        assetBalance: assetToBase(assetAmount(20)), // 1 BUSD = 0.05 RUNE
        runeBalance: assetToBase(assetAmount(1)) // 1 RUNE = 20 BUSD
      },
      'ETH.USDT-0xa3910454bf2cb59b8b3a401589a3bacc5ca42306': {
        assetBalance: assetToBase(assetAmount(20)), // 1 USDT = 0.05 RUNE
        runeBalance: assetToBase(assetAmount(1)) // 1 RUNE = 20 USDT
      },
      'BNB.BNB': {
        assetBalance: assetToBase(assetAmount(1)), // 1 BNB = 30 RUNE (600 USD)
        runeBalance: assetToBase(assetAmount(30)) // 1 RUNE = 0.03 BNB
      },
      'ETH.ETH': {
        assetBalance: assetToBase(assetAmount(1)), // 1 ETH = 100 RUNE (2000 USD)
        runeBalance: assetToBase(assetAmount(100)) // 1 RUNE = 0.01 ETH
      },
      'BTC.BTC': {
        assetBalance: assetToBase(assetAmount(1)), // 1 BTC = 100 RUNE (2000 USD)
        runeBalance: assetToBase(assetAmount(100)) // 1 RUNE = 0.01 BTC
      }
    }

    it('non chain asset -> chain asset (same chain): BNB.USD -> BNB.BNB)', () => {
      const inAssetDecimal = 6
      const params = {
        swapFees: {
          inFee: {
            amount: assetToBase(assetAmount(0.0001, BSC_GAS_ASSET_DECIMAL)),
            asset: AssetBSC
          },
          outFee: {
            amount: assetToBase(assetAmount(0.0003, BSC_GAS_ASSET_DECIMAL)),
            asset: AssetBSC
          }
        },
        inAsset: AssetUSDTBSC,
        inAssetDecimal,
        outAsset: AssetBSC,
        poolsData
      }
      // Prices
      // 1 BNB = 600 BUSD or 1 BUSD = 0,001666667 BNB
      // Formula:
      // 1.5 * (inboundFeeInBUSD + outboundFeeInBUSD)
      // = 1.5 * (0.0001 * 600 + 0.0003 * 600)
      // = 1.5 * (0.06 + 0,18) = 1.5 * 0.24
      // = 0.36

      // Prices
      // 1 BNB = 600 BUSD or 1 BUSD = 0,001666667 BNB
      //
      // Formula (success):
      // inboundFeeInBUSD + outboundFeeInBUSD
      // 0.0001 * 600 + 0.0003 * 600 = 0.06 + 0,18 = 0.24
      //
      // Formula (failure):
      // inboundFeeInBUSD + refundFeeInBUSD
      // 0.0001 * 600 + 0.0003 * 600 = 0.06 + 0,18 = 0.24
      //
      // Formula (minValue):
      // 1,5 * max(success, failure)
      // 1,5 * max(0.24, 0.24) = 1,5 * 0.24 = 0.36

      const result = minAmountToSwapMax1e8(params)
      console.log(
        `non chain asset -> chain asset (same chain): BNB.USD -> BNB.BNB) : ${result
          .amount()
          .toFixed(8, 2)}, expected is 0.36`
      )
      expect(eqBaseAmount.equals(result, assetToBase(assetAmount(0.36, inAssetDecimal)))).toBeTruthy()
    })

    it('chain asset -> non chain asset (same chain): BSC.BNB -> BSC.USDT', () => {
      const inAssetDecimal = BSC_GAS_ASSET_DECIMAL
      const params = {
        swapFees: {
          inFee: {
            amount: assetToBase(assetAmount(0.0001)),
            asset: AssetBSC
          },
          outFee: {
            amount: assetToBase(assetAmount(0.0003)),
            asset: AssetBSC
          }
        },
        inAsset: AssetBSC,
        inAssetDecimal,
        outAsset: AssetUSDTBSC,
        poolsData
      }

      // Prices
      // All in BNB

      // Formula (success):
      // inboundFeeInBNB + outboundFeeInBNB
      // 0.0001 + 0.0003 = 0.0004
      //
      // Formula (failure):
      // inboundFeeInBNB + refundFeeInBNB
      // 0.0001 + 0.0003 = 0.0004
      //
      // Formula (minValue):
      // 1,5 * max(success, failure)
      // 1,5 * max(0.0004, 0.0004) = 1,5 * 0.0004 = 0.0006

      const result = minAmountToSwapMax1e8(params)
      console.log(
        `chain asset -> non chain asset (same chain): BSC.BNB -> BSC.USDT': ${result
          .amount()
          .toFixed(8, 2)}, expected is 0.0006`
      )
      expect(eqBaseAmount.equals(result, assetToBase(assetAmount(0.0006, inAssetDecimal)))).toBeTruthy()
    })

    it('chain asset -> chain asset (same chains): ETH.USDT -> ETH.ETH', () => {
      const inAssetDecimal = 7
      const params = {
        swapFees: {
          inFee: {
            amount: assetToBase(assetAmount(0.01, ETH_DECIMAL)),
            asset: AssetETH
          },
          outFee: {
            amount: assetToBase(assetAmount(0.03, ETH_DECIMAL)),
            asset: AssetETH
          }
        },
        inAsset: AssetUSDTERC20Testnet,
        inAssetDecimal,
        outAsset: AssetETH,
        poolsData
      }
      // Prices
      // 1 ETH = 2000 USDT or 1 USDT = 0,0005 ETH
      //
      // Formula (success):
      // inboundFeeInUSDT + outboundFeeInUSDT
      // 0.01 * 2000 + 0.03 * 2000 = 20 + 60 = 80
      //
      // Formula (failure):
      // inboundFeeInUSDT + refundFeeInUSDT
      // 0.01 * 2000 + 0.03 * 2000 = 20 + 60 = 80
      //
      // Formula (minValue):
      // 1,5 * max(success, failure)
      // 1,5 * max(80, 80) = 1,5 * 80 = 120

      const result = minAmountToSwapMax1e8(params)
      expect(eqBaseAmount.equals(result, assetToBase(assetAmount(120, inAssetDecimal)))).toBeTruthy()
    })

    it('chain asset -> chain asset (different chains): BNB.BSC -> ETH.ETH', () => {
      const inAssetDecimal = BSC_GAS_ASSET_DECIMAL
      const params = {
        swapFees: {
          inFee: {
            amount: assetToBase(assetAmount(0.0001, inAssetDecimal)),
            asset: AssetBSC
          },
          outFee: {
            amount: assetToBase(assetAmount(0.01, ETH_DECIMAL)),
            asset: AssetETH
          }
        },
        inAsset: AssetBSC,
        inAssetDecimal,
        outAsset: AssetETH,
        poolsData
      }
      // Prices
      // 1 BNB = 0.3 ETH or 1 ETH = 3.33 BNB
      //
      // Formula (success):
      // inboundFeeInBNB + outboundFeeInBNB
      // 0.0001 + (0.01 * 3.33) = 0.0001 + 0,0333 = 0.0334
      //
      // Formula (failure):
      // inboundFeeInBNB + refundFeeInBNB
      // 0.0001 + 0.0003 = 0.0004
      //
      // Formula (minValue):
      // 1,5 * max(success, failure)
      // 1,5 * max(0.03343, 0.0004) = 1,5 * 0.03343 = 0.0501

      const result = minAmountToSwapMax1e8(params)

      expect(eqBaseAmount.equals(result, assetToBase(assetAmount(0.05015, inAssetDecimal)))).toBeTruthy()
    })

    it('chain asset -> non chain asset (different chains): THOR.RUNE -> ETH.USDT)', () => {
      const inAssetDecimal = THORCHAIN_DECIMAL
      const params = {
        swapFees: {
          inFee: {
            amount: assetToBase(assetAmount(0.02, THORCHAIN_DECIMAL)),
            asset: AssetRuneNative
          },
          outFee: {
            amount: assetToBase(assetAmount(0.01, ETH_DECIMAL)),
            asset: AssetETH
          }
        },
        inAsset: AssetRuneNative,
        inAssetDecimal,
        outAsset: AssetUSDTERC20Testnet,
        poolsData
      }
      // Prices
      // 1 ETH = 100 RUNE
      // 1 RUNE = 0.01 ETH
      //
      // Formula (success):
      // inboundFeeInRUNE + outboundFeeInRUNE
      // 0.02 + 0.01 * 100 = 0.02 + 1 = 1.02
      //
      // Formula (failure):
      // inboundFeeInRUNE + refundFeeInRUNE
      // 0.02 + 0.06 = 0.08
      //
      // Formula (minValue):
      // 1,5 * max(success, failure)
      // 1,5 * max(1.02, 0.08) = 1,5 * 1.02 = 4,53

      const result = minAmountToSwapMax1e8(params)
      expect(eqBaseAmount.equals(result, assetToBase(assetAmount(1.53, inAssetDecimal)))).toBeTruthy()
    })

    it('non chain asset -> non chain asset (different chains): BNB.USDT -> ETH.USDT', () => {
      const inAssetDecimal = 7
      const params = {
        swapFees: {
          inFee: {
            amount: assetToBase(assetAmount(0.0001)),
            asset: AssetBSC
          },
          outFee: {
            amount: assetToBase(assetAmount(0.01)),
            asset: AssetETH
          }
        },
        inAsset: AssetUSDTBSC,
        inAssetDecimal,
        outAsset: AssetUSDT62E,
        poolsData
      }

      // Prices
      // 1 ETH = 2000 USD or 1 USD = 0,0005 ETH
      // 1 BNB = 600 USD or 1 USD = 0,001666667 BNB
      //
      // Formula (success):
      // outboundFeeInBUSD
      // (0.01 * 2000) = 20
      //
      // Formula (failure):
      // inboundFeeInBUSD + refundFeeInBUSD
      // (0.0001 * 600) + (0.0003 * 600) = 0.06 + 0.18 = 0.24
      //
      // Formula (minValue):
      // 1,5 * max(success, failure)
      // 1,5 * max(20, 0.24) = 1,5 * 20 = 30

      const result = minAmountToSwapMax1e8(params)

      expect(eqBaseAmount.equals(result, assetToBase(assetAmount(30, inAssetDecimal)))).toBeTruthy()
    })

    it(`UTXO assets' min amount should be over estimated with 10k Sats`, () => {
      const inAssetDecimal = BTC_DECIMAL
      const params = {
        swapFees: {
          inFee: {
            amount: assetToBase(assetAmount(0.0001)),
            asset: AssetBTC
          },
          outFee: {
            amount: assetToBase(assetAmount(0.01)),
            asset: AssetETH
          }
        },
        inAsset: AssetBTC,
        inAssetDecimal,
        outAsset: AssetETH,
        poolsData
      }
      // Prices
      // 1 ETH = 1 BTC or 1 BTC = 1 ETH
      //
      // Formula (success):
      // inboundFeeInBTC + outboundFeeInBTC
      // 0.0001 + (0.01 * 1) = 0.0001 + 1 = 0.0101
      //
      // Formula (failure):
      // inboundFeeInBTC + refundFeeInBTC
      // 0.0001 + (0.0003 * 1) = 0.0001 + 0.0003 = 0.0004
      //
      // Formula (minValue):
      // 1,5 * max(success, failure)
      // 1,5 * max(0.0101, 0.0004) = 1,5 * 0.0101 = 0.01515
      // AND as this is UTXO asset overestimate with 10k Satoshis => 0.01515 + 10k Satoshis = 0.01525

      const result = minAmountToSwapMax1e8(params)
      expect(eqBaseAmount.equals(result, assetToBase(assetAmount(0.01525, inAssetDecimal)))).toBeTruthy()
    })
  })

  describe('maxAmountToSwapMax1e8', () => {
    it('balance to swap - with estimated fees', () => {
      const params = {
        balanceAmountMax1e8: baseAmount(1000),
        asset: AssetBSC,
        feeAmount: baseAmount(100)
      }
      const result = maxAmountToSwapMax1e8(params)
      expect(eqBaseAmount.equals(result, baseAmount(900))).toBeTruthy()
    })

    it('balance to swap - with 1e18 based estimated fees', () => {
      const params = {
        balanceAmountMax1e8: baseAmount(100),
        asset: AssetETH,
        feeAmount: baseAmount(100000000000, 18)
      }
      const result = maxAmountToSwapMax1e8(params)
      expect(eqBaseAmount.equals(result, baseAmount(90))).toBeTruthy()
    })

    it('balance is less than fee - with 1e18 based estimated fees', () => {
      const params = {
        balanceAmountMax1e8: baseAmount(1),
        asset: AssetETH,
        feeAmount: baseAmount(100000000000, 18)
      }
      const result = maxAmountToSwapMax1e8(params)
      expect(eqBaseAmount.equals(result, baseAmount(0))).toBeTruthy()
    })

    it('no chain asset - no change', () => {
      const params = {
        balanceAmountMax1e8: baseAmount(100),
        asset: AssetUSDCBSC,
        feeAmount: baseAmount(50, 8)
      }
      const result = maxAmountToSwapMax1e8(params)
      expect(eqBaseAmount.equals(result, baseAmount(100))).toBeTruthy()
    })
  })

  describe('assetsInWallet', () => {
    const a = mockWalletBalance()
    const b = mockWalletBalance({ asset: AssetBSC })
    const c = mockWalletBalance({ asset: AssetBTC })

    it('empty list of assets for empty balances', () => {
      const result = assetsInWallet([])
      expect(result).toEqual([])
    })

    it('filter out assets', () => {
      const assets = assetsInWallet([a, b, c])

      expect(assets.length).toEqual(3)
      expect(eqAsset.equals(assets[0], AssetRuneNative)).toBeTruthy()
      expect(eqAsset.equals(assets[1], AssetBSC)).toBeTruthy()
      expect(eqAsset.equals(assets[2], AssetBTC)).toBeTruthy()
    })
  })

  describe('balancesToSwapFrom', () => {
    const runeBalance = mockWalletBalance()
    const runeBalanceLedger = mockWalletBalance({
      walletType: 'ledger',
      amount: baseAmount(2)
    })
    const bnbBalance = mockWalletBalance({
      ...runeBalance,
      asset: AssetBSC
    })

    it('RUNE ledger + Keystore ', () => {
      const result = balancesToSwapFrom({
        assetsToSwap: O.some({ source: AssetBSC, target: AssetRuneNative }),
        walletBalances: [runeBalance, runeBalanceLedger, bnbBalance]
      })
      expect(result.length).toEqual(2)
      // Keystore THOR.RUNE
      expect(result[0].walletType).toEqual('keystore')
      expect(eqAsset.equals(result[0].asset, AssetRuneNative)).toBeTruthy()
      // Ledger THOR.RUNE
      expect(result[1].walletType).toEqual('ledger')
      expect(eqAsset.equals(result[1].asset, AssetRuneNative)).toBeTruthy()
    })

    it('RUNE ledger + Keystore ', () => {
      const result = balancesToSwapFrom({
        assetsToSwap: O.some({ source: AssetRuneNative, target: AssetBSC }),
        walletBalances: [runeBalance, runeBalanceLedger, bnbBalance]
      })
      expect(result.length).toEqual(1)
      // Keystore BNB.BNB
      expect(result[0].walletType).toEqual('keystore')
      expect(eqAsset.equals(result[0].asset, AssetBSC)).toBeTruthy()
    })
  })

  describe('hasLedgerInBalancesByChain', () => {
    const runeBalance = mockWalletBalance()
    const runeBalanceLedger = mockWalletBalance({
      walletType: 'ledger',
      amount: baseAmount(2)
    })
    const bnbBalance = mockWalletBalance({
      ...runeBalance,
      asset: AssetBSC
    })

    const balances = [runeBalance, runeBalanceLedger, bnbBalance]

    it('has RUNE ledger ', () => {
      const result = hasLedgerInBalancesByChain(THORChain, balances)
      expect(result).toBeTruthy()
    })
    it('has not BTC ledger ', () => {
      const result = hasLedgerInBalancesByChain(BTCChain, balances)
      expect(result).toBeFalsy()
    })
  })
})
