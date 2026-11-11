import { BTCChain, BTC_DECIMAL } from '@xchainjs/xchain-bitcoin'
import { BSC_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-bsc'
import { ETH_GAS_ASSET_DECIMAL as ETH_DECIMAL } from '@xchainjs/xchain-ethereum'

import { PoolDetail as PoolDetailMaya } from '@xchainjs/xchain-mayamidgard'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { assetAmount, assetFromStringEx, assetToBase, assetToString, baseAmount, bn } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'

import { ONE_RUNE_BASE_AMOUNT } from '../../../shared/mock/amount'
import { ASSETS_MAINNET } from '../../../shared/mock/assets'
import { AssetBTC, AssetETH, AssetRuneNative, AssetBSC } from '../../../shared/utils/asset'
import { AssetCacao, CACAO_DECIMAL, MAYAChain, MAYA_DECIMAL, THORChain } from '../../../shared/utils/chainIds'
import { WalletType } from '../../../shared/wallet/types'
import { AssetUSDCBSC, AssetUSDT62E, AssetUSDTERC20Testnet } from '../../const'
import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { eqAsset, eqBaseAmount } from '../../helpers/fp/eq'
import { mockWalletBalance } from '../../helpers/test/testWalletHelper'
import { PoolsDataMap } from '../../services/midgard/midgardTypes'
import {
  pickPoolAsset,
  calcRefundFee,
  minAmountToSwapMax1e8,
  maxAmountToSwap,
  maxAmountToSwapMax1e8,
  capNativeRuneDeposit,
  poolDepthToBaseAmount,
  capAmountToMax,
  tradeSwapLockedMax1e8,
  isAtOrBelowDust,
  assetsInWallet,
  balancesToSwapFrom,
  hasLedgerInBalancesByChain
} from './Swap.utils'

describe('components/swap/utils', () => {
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
          ASSETS_MAINNET.USDT
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
      'BSC.USDC-0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d': {
        assetBalance: assetToBase(assetAmount(20)), // 1 USDT = 0.05 RUNE
        dexBalance: assetToBase(assetAmount(1)) // 1 RUNE = 20 USDT
      },
      'ETH.USDT-0xa3910454bf2cb59b8b3a401589a3bacc5ca42306': {
        assetBalance: assetToBase(assetAmount(20)), // 1 USDT = 0.05 RUNE
        dexBalance: assetToBase(assetAmount(1)) // 1 RUNE = 20 USDT
      },
      'BSC.BNB': {
        assetBalance: assetToBase(assetAmount(1)), // 1 BNB = 30 RUNE (600 USD)
        dexBalance: assetToBase(assetAmount(30)) // 1 RUNE = 0.03 BNB
      },
      'ETH.ETH': {
        assetBalance: assetToBase(assetAmount(1)), // 1 ETH = 100 RUNE (2000 USD)
        dexBalance: assetToBase(assetAmount(100)) // 1 RUNE = 0.01 ETH
      },
      'BTC.BTC': {
        assetBalance: assetToBase(assetAmount(1)), // 1 BTC = 100 RUNE (2000 USD)
        dexBalance: assetToBase(assetAmount(100)) // 1 RUNE = 0.01 BTC
      }
    }

    it('non chain asset -> chain asset (same chain): BNB.USDC -> BSC.BNB)', () => {
      const inAssetDecimal = 8 // as per midgard pool data.
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
        inAsset: AssetUSDCBSC,
        inAssetDecimal,
        outAsset: AssetBSC,
        poolsData
      }
      // Prices
      // 1 BSC.BNB = 600 BUSD or 1 USDT = 0,001666667 BSC.BNB
      // Formula:
      // 1.5 * (inboundFeeInUSDT + outboundFeeInUSDT)
      // = 1.5 * (0.0001 * 600 + 0.0003 * 600)
      // = 1.5 * (0.06 + 0,18) = 1.5 * 0.24
      // = 0.36

      // Prices
      // 1 BSC.BNB = 600 USDT or 1 USDT = 0,001666667 BSC.BNB
      //
      // Formula (success):
      // inboundFeeInUSDT+ outboundFeeInUSDT
      // 0.0001 * 600 + 0.0003 * 600 = 0.06 + 0,18 = 0.24
      //
      // Formula (failure):
      // inboundFeeInUSDT + refundFeeInUSDT
      // 0.0001 * 600 + 0.0003 * 600 = 0.06 + 0,18 = 0.24
      //
      // Formula (minValue):
      // 1,5 * max(success, failure)
      // 1,5 * max(0.24, 0.24) = 1,5 * 0.24 = 0.36

      const result = minAmountToSwapMax1e8(params)
      expect(eqBaseAmount.equals(result, assetToBase(assetAmount(0.36, inAssetDecimal)))).toBeTruthy() // not working
    })

    it('chain asset -> non chain asset (same chain): BSC.BNB -> BSC.USDC', () => {
      const inAssetDecimal = 8
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
        inAsset: AssetBSC,
        inAssetDecimal,
        outAsset: AssetUSDCBSC,
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

    it('chain asset -> chain asset (different chains): BSC.BNB -> ETH.ETH', () => {
      const inAssetDecimal = 8
      const params = {
        swapFees: {
          inFee: {
            amount: assetToBase(assetAmount(0.0001)),
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

    it('non chain asset -> non chain asset (different chains): BSB.USDT -> ETH.USDT', () => {
      const inAssetDecimal = 7
      const params = {
        swapFees: {
          inFee: {
            amount: assetToBase(assetAmount(0.0001, BSC_GAS_ASSET_DECIMAL)),
            asset: AssetBSC
          },
          outFee: {
            amount: assetToBase(assetAmount(0.01, ETH_DECIMAL)),
            asset: AssetETH
          }
        },
        inAsset: AssetUSDCBSC,
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

    it(`UTXO assets' min amount calculation`, () => {
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
      // 0.0001 + (0.01 * 1) = 0.0001 + 0.01 = 0.0101
      //
      // Formula (failure):
      // inboundFeeInBTC + refundFeeInBTC
      // 0.0001 + (0.0003 * 1) = 0.0001 + 0.0003 = 0.0004
      //
      // Formula (minValue):
      // 1.5 * max(success, failure)
      // 1.5 * max(0.0101, 0.0004) = 1.5 * 0.0101 = 0.01515
      // UTXO safety buffer is no longer added in minAmountToSwapMax1e8

      const result = minAmountToSwapMax1e8(params)
      expect(eqBaseAmount.equals(result, assetToBase(assetAmount(0.01515, inAssetDecimal)))).toBeTruthy()
    })
  })

  describe('maxAmountToSwapMax1e8', () => {
    it('balance to swap - with estimated fees', () => {
      const params = {
        balanceAmountMax1e8: baseAmount(50000),
        asset: AssetBTC,
        feeAmount: baseAmount(100)
      }
      const result = maxAmountToSwapMax1e8(params)
      // Expect calculation: 50000 - 100 = 49900 (no UTXO safety buffer in swap calculation)
      expect(eqBaseAmount.equals(result, baseAmount(49900))).toBeTruthy()
    })

    it('balance to swap - with 1e18 based estimated fees', () => {
      const params = {
        balanceAmountMax1e8: baseAmount(5000),
        asset: AssetETH,
        feeAmount: baseAmount(100000000000, 18)
      }
      const result = maxAmountToSwapMax1e8(params)
      // 100000000000 with 18 decimals = 10 sats when converted to max1e8
      // So: 5000 - 10 = 4990 (no more 1000-unit rounding)
      expect(eqBaseAmount.equals(result, baseAmount(4990))).toBeTruthy()
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

    it('non-UTXO asset should not have safety buffer applied', () => {
      const params = {
        balanceAmountMax1e8: baseAmount(5000),
        asset: AssetETH, // Non-UTXO chain
        feeAmount: baseAmount(100)
      }
      const result = maxAmountToSwapMax1e8(params)
      // Expect calculation without safety buffer: 5000 - 100 = 4900
      expect(eqBaseAmount.equals(result, baseAmount(4900))).toBeTruthy()
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

    // 1 RUNE = 100_000_000 base units. NativeTransactionFee is 0.02 RUNE = 2_000_000.
    const oneRune = baseAmount(100_000_000, THORCHAIN_DECIMAL)

    it('native RUNE leaves 0.02 and ignores the quoted fee', () => {
      const result = maxAmountToSwapMax1e8({
        balanceAmountMax1e8: oneRune,
        asset: AssetRuneNative,
        feeAmount: baseAmount(50_000_000, BTC_DECIMAL)
      })
      expect(eqBaseAmount.equals(result, baseAmount(98_000_000, THORCHAIN_DECIMAL))).toBeTruthy()
    })

    it('native RUNE balance below 0.02 is zero', () => {
      const result = maxAmountToSwap({
        balanceAmount: baseAmount(1_000_000, THORCHAIN_DECIMAL),
        asset: AssetRuneNative,
        feeAmount: baseAmount(0, THORCHAIN_DECIMAL)
      })
      expect(eqBaseAmount.equals(result, baseAmount(0, THORCHAIN_DECIMAL))).toBeTruthy()
    })
  })

  describe('capNativeRuneDeposit', () => {
    const oneRune = baseAmount(100_000_000, THORCHAIN_DECIMAL)

    it('lowers a full-balance amount to balance - 0.02', () => {
      const result = capNativeRuneDeposit(oneRune, oneRune)
      expect(eqBaseAmount.equals(result, baseAmount(98_000_000, THORCHAIN_DECIMAL))).toBeTruthy()
    })

    it('leaves an amount that already covers the ante', () => {
      const half = baseAmount(50_000_000, THORCHAIN_DECIMAL)
      expect(eqBaseAmount.equals(capNativeRuneDeposit(half, oneRune), half)).toBeTruthy()
    })
  })

  // Locked-wallet / quote-only max. Values: Maya Midgard pools.json, 1 Nov 2026 (ETH.ETH assetDepth/runeDepth).
  describe('poolDepthToBaseAmount', () => {
    it('converts an 8-decimal ETH pool depth into 18 decimals (255.56355175 ETH)', () => {
      const result = poolDepthToBaseAmount('25556355175', THORCHAIN_DECIMAL, ETH_DECIMAL)
      expect(result.decimal).toEqual(ETH_DECIMAL)
      expect(result.amount().toFixed()).toEqual('255563551750000000000')
    })

    it('labels a Maya CACAO depth (1e10) with CACAO_DECIMAL', () => {
      const result = poolDepthToBaseAmount('49691594688169982', CACAO_DECIMAL, CACAO_DECIMAL)
      expect(eqBaseAmount.equals(result, baseAmount('49691594688169982', CACAO_DECIMAL))).toBeTruthy()
    })

    it('scales an 8-decimal depth down for a 4-decimal source asset (MAYA)', () => {
      const result = poolDepthToBaseAmount('100000000', THORCHAIN_DECIMAL, MAYA_DECIMAL)
      expect(eqBaseAmount.equals(result, baseAmount(10_000, MAYA_DECIMAL))).toBeTruthy()
    })

    it('leaves an 8-decimal depth unchanged for an 8-decimal source asset (BTC)', () => {
      const result = poolDepthToBaseAmount('1986071315', THORCHAIN_DECIMAL, BTC_DECIMAL)
      expect(eqBaseAmount.equals(result, baseAmount('1986071315', BTC_DECIMAL))).toBeTruthy()
    })
  })

  describe('capAmountToMax', () => {
    const ethDepth1e8 = baseAmount('25556355175', THORCHAIN_DECIMAL) // 255.56355175 ETH

    it('leaves 0.001 ETH (1e15 @18) unchanged against a 255.56 ETH max given in 8 decimals', () => {
      const amount = baseAmount('1000000000000000', ETH_DECIMAL)
      expect(eqBaseAmount.equals(capAmountToMax(amount, ethDepth1e8), amount)).toBeTruthy()
    })

    it('caps 300 ETH at the 255.56 ETH max, in the amount decimals', () => {
      const amount = baseAmount('300000000000000000000', ETH_DECIMAL)
      const result = capAmountToMax(amount, ethDepth1e8)
      expect(eqBaseAmount.equals(result, baseAmount('255563551750000000000', ETH_DECIMAL))).toBeTruthy()
    })

    it('caps and keeps amounts with matching decimals as before', () => {
      const max = baseAmount(100_000_000, BTC_DECIMAL)
      const over = baseAmount(200_000_000, BTC_DECIMAL)
      const under = baseAmount(50_000_000, BTC_DECIMAL)
      expect(eqBaseAmount.equals(capAmountToMax(over, max), max)).toBeTruthy()
      expect(eqBaseAmount.equals(capAmountToMax(under, max), under)).toBeTruthy()
    })

    it('leaves 0.5 CACAO (@10) unchanged against a 1-unit max given in 8 decimals', () => {
      const amount = baseAmount(5_000_000_000, CACAO_DECIMAL)
      expect(eqBaseAmount.equals(capAmountToMax(amount, ONE_RUNE_BASE_AMOUNT), amount)).toBeTruthy()
    })

    it('caps 2 CACAO at 1 CACAO in CACAO_DECIMAL', () => {
      const amount = baseAmount(20_000_000_000, CACAO_DECIMAL)
      const result = capAmountToMax(amount, ONE_RUNE_BASE_AMOUNT)
      expect(eqBaseAmount.equals(result, baseAmount(10_000_000_000, CACAO_DECIMAL))).toBeTruthy()
    })
  })

  // BaseAmount gt/lt/eq compare raw base units and ignore the other side's decimal (xchain-util asset.ts:63-80)
  describe('8-decimal pool depth vs 18-decimal ETH amount', () => {
    const ethDepth1e8 = baseAmount('25556355175', THORCHAIN_DECIMAL) // 255.56355175 ETH
    const smallEth = baseAmount('1000000000000000', ETH_DECIMAL) // 0.001 ETH
    const bigEth = baseAmount('300000000000000000000', ETH_DECIMAL) // 300 ETH
    const sameEth = baseAmount('255563551750000000000', ETH_DECIMAL) // 255.56355175 ETH

    it('capAmountToMax keeps an amount equal to the depth, in 18 decimals', () => {
      expect(eqBaseAmount.equals(capAmountToMax(sameEth, ethDepth1e8), sameEth)).toBeTruthy()
    })

    it('capAmountToMax caps 300 ETH at the depth, in 18 decimals', () => {
      expect(eqBaseAmount.equals(capAmountToMax(bigEth, ethDepth1e8), sameEth)).toBeTruthy()
    })

    it('isAtOrBelowDust: 0.001 ETH and 255.56 ETH are at or below an 8-decimal 255.56 ETH threshold, 300 ETH is not', () => {
      expect(isAtOrBelowDust(smallEth, ethDepth1e8)).toBe(true)
      expect(isAtOrBelowDust(sameEth, ethDepth1e8)).toBe(true)
      expect(isAtOrBelowDust(bigEth, ethDepth1e8)).toBe(false)
    })
  })

  describe('tradeSwapLockedMax1e8', () => {
    const ethTrade = assetFromStringEx('ETH~ETH')
    const btcTrade = assetFromStringEx('BTC~BTC')
    // THOR pools (assetDepth and runeDepth @1e8). There is no RUNE pool.
    const ethPool = {
      asset: assetToString(AssetETH),
      assetDepth: '2555635517500',
      runeDepth: '900000000000000'
    } as PoolDetail
    const btcPool = {
      asset: assetToString(AssetBTC),
      assetDepth: '198607131500',
      runeDepth: '123450000000000'
    } as PoolDetail
    const poolDetails = [ethPool, btcPool]

    it('caps a trade asset at its SOURCE pool asset depth (ETH~ETH to BTC~BTC)', () => {
      const result = tradeSwapLockedMax1e8({
        protocol: THORChain,
        sourceAsset: ethTrade,
        targetAsset: btcTrade,
        sourceAssetDecimal: THORCHAIN_DECIMAL,
        poolDetails,
        poolDetailsMaya: []
      })
      expect(eqBaseAmount.equals(result, baseAmount(ethPool.assetDepth, THORCHAIN_DECIMAL))).toBeTruthy()
    })

    it('caps a RUNE source at the TARGET pool RUNE depth, as there is no RUNE pool (THOR.RUNE to BTC~BTC)', () => {
      const result = tradeSwapLockedMax1e8({
        protocol: THORChain,
        sourceAsset: AssetRuneNative,
        targetAsset: btcTrade,
        sourceAssetDecimal: THORCHAIN_DECIMAL,
        poolDetails,
        poolDetailsMaya: []
      })
      expect(eqBaseAmount.equals(result, baseAmount(btcPool.runeDepth, THORCHAIN_DECIMAL))).toBeTruthy()
    })

    it('caps a CACAO source at the TARGET pool CACAO depth (1e10), returned in 8 decimals (MAYA.CACAO to BTC~BTC)', () => {
      // Maya pool: runeDepth is CACAO @1e10, 12,345 CACAO
      const btcPoolMaya = {
        asset: assetToString(AssetBTC),
        assetDepth: '198607131500',
        runeDepth: '123450000000000'
      } as PoolDetailMaya
      const result = tradeSwapLockedMax1e8({
        protocol: MAYAChain,
        sourceAsset: AssetCacao,
        targetAsset: btcTrade,
        sourceAssetDecimal: CACAO_DECIMAL,
        poolDetails: [],
        poolDetailsMaya: [btcPoolMaya]
      })
      expect(eqBaseAmount.equals(result, baseAmount('1234500000000', THORCHAIN_DECIMAL))).toBeTruthy()
    })

    it('caps a CACAO source at the MAYA target pool CACAO depth on a THORChain screen, and HALF is half of it (MAYA.CACAO to BTC~BTC)', () => {
      // The trade route can stay on THORChain for a CACAO source, but CACAO only has Maya pools.
      // Live depths: THOR BTC runeDepth @1e8, Maya BTC runeDepth = CACAO @1e10.
      const thorBtcPool = {
        asset: assetToString(AssetBTC),
        assetDepth: '19284684716',
        runeDepth: '2194777830964710'
      } as PoolDetail
      const mayaBtcPool = {
        asset: assetToString(AssetBTC),
        assetDepth: '1993744534',
        runeDepth: '133977127590589562'
      } as PoolDetailMaya
      const result = tradeSwapLockedMax1e8({
        protocol: THORChain,
        sourceAsset: AssetCacao,
        targetAsset: btcTrade,
        sourceAssetDecimal: CACAO_DECIMAL,
        poolDetails: [thorBtcPool],
        poolDetailsMaya: [mayaBtcPool]
      })
      // 13,397,712.75905895 CACAO in 8 decimals, not THOR's 219,477.78 (runeDepth / 1e10)
      expect(eqBaseAmount.equals(result, baseAmount('1339771275905895', THORCHAIN_DECIMAL))).toBeTruthy()
      // HALF the way TradeSwap's percent buttons build it (TradeSwap.tsx setAmountToSwapFromPercentValue)
      const half = baseAmount(result.amount().multipliedBy(50 / 100), result.decimal)
      expect(eqBaseAmount.equals(half, baseAmount('669885637952948', THORCHAIN_DECIMAL))).toBeTruthy()
    })

    it('falls back to 1 unit, in at most 8 decimals, when no pool is found', () => {
      const result = tradeSwapLockedMax1e8({
        protocol: MAYAChain,
        sourceAsset: AssetCacao,
        targetAsset: btcTrade,
        sourceAssetDecimal: CACAO_DECIMAL,
        poolDetails,
        poolDetailsMaya: []
      })
      expect(eqBaseAmount.equals(result, baseAmount(100_000_000, THORCHAIN_DECIMAL))).toBeTruthy()
    })
  })

  describe('isAtOrBelowDust', () => {
    it('is true for 0.00005 ETH (@18) against a 0.0001 dust given in 8 decimals', () => {
      expect(isAtOrBelowDust(baseAmount('50000000000000', ETH_DECIMAL), baseAmount(10_000, 8))).toBe(true)
    })

    it('is false for 50 USDC (@6) against a 1-unit dust given in 8 decimals', () => {
      expect(isAtOrBelowDust(baseAmount(50_000_000, 6), baseAmount(100_000_000, 8))).toBe(false)
    })

    it('is false for 0.01 BTC against a 0.0001 BTC dust (same decimals)', () => {
      expect(isAtOrBelowDust(baseAmount(1_000_000, BTC_DECIMAL), baseAmount(10_000, BTC_DECIMAL))).toBe(false)
    })

    it('is true for an amount equal to the dust (same decimals)', () => {
      expect(isAtOrBelowDust(baseAmount(10_000, BTC_DECIMAL), baseAmount(10_000, BTC_DECIMAL))).toBe(true)
    })

    it('is false for an empty (zero) amount, so a cleared field shows no dust error', () => {
      expect(isAtOrBelowDust(baseAmount(0, BTC_DECIMAL), baseAmount(0, BTC_DECIMAL))).toBe(false)
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
    const dexBalance = mockWalletBalance()
    const runeBalanceLedger = mockWalletBalance({
      walletType: WalletType.Ledger,
      amount: baseAmount(2)
    })
    const bnbBalance = mockWalletBalance({
      ...dexBalance,
      asset: AssetBSC
    })

    it('RUNE ledger + Keystore ', () => {
      const result = balancesToSwapFrom({
        assetsToSwap: O.some({ source: AssetBSC, target: AssetRuneNative }),
        walletBalances: [dexBalance, runeBalanceLedger, bnbBalance]
      })
      expect(result.length).toEqual(2)
      // Keystore THOR.RUNE
      expect(result[0].walletType).toEqual(WalletType.Keystore)
      expect(eqAsset.equals(result[0].asset, AssetRuneNative)).toBeTruthy()
      // Ledger THOR.RUNE
      expect(result[1].walletType).toEqual(WalletType.Ledger)
      expect(eqAsset.equals(result[1].asset, AssetRuneNative)).toBeTruthy()
    })

    it('RUNE ledger + Keystore ', () => {
      const result = balancesToSwapFrom({
        assetsToSwap: O.some({ source: AssetRuneNative, target: AssetBSC }),
        walletBalances: [dexBalance, runeBalanceLedger, bnbBalance]
      })
      expect(result.length).toEqual(1)
      // Keystore BSC.BNB
      expect(result[0].walletType).toEqual('keystore')
      expect(eqAsset.equals(result[0].asset, AssetBSC)).toBeTruthy()
    })
  })

  describe('hasLedgerInBalancesByChain', () => {
    const dexBalance = mockWalletBalance()
    const runeBalanceLedger = mockWalletBalance({
      walletType: WalletType.Ledger,
      amount: baseAmount(2)
    })
    const bnbBalance = mockWalletBalance({
      ...dexBalance,
      asset: AssetBSC
    })

    const balances = [dexBalance, runeBalanceLedger, bnbBalance]

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
