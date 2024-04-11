import * as RD from '@devexperts/remote-data-ts'
import { BTC_DECIMAL, BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { COSMOS_DECIMAL } from '@xchainjs/xchain-cosmos'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { ETH_GAS_ASSET_DECIMAL as ETH_DECIMAL } from '@xchainjs/xchain-ethereum'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { BtcChain } from '@xchainjs/xchain-mayachain-query'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { assetAmount, assetToBase, assetToString, baseAmount, bn } from '@xchainjs/xchain-util'
import { Chain } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import { BSC_ADDRESS_TESTNET, RUNE_ADDRESS_TESTNET } from '../../../shared/mock/address'
import {
  ONE_RUNE_BASE_AMOUNT,
  FOUR_RUNE_BASE_AMOUNT,
  THREE_RUNE_BASE_AMOUNT,
  TWO_RUNE_BASE_AMOUNT
} from '../../../shared/mock/amount'
import { AssetATOM, AssetBSC, AssetBTC, AssetETH, AssetLTC, AssetRuneNative } from '../../../shared/utils/asset'
import { PRICE_POOLS_WHITELIST, AssetUSDC, AssetUSDTDAC, AssetUSDCBSC } from '../../const'
import { eqAsset, eqPoolShare, eqPoolShares, eqOAssetWithAmount, eqString } from '../../helpers/fp/eq'
import { RUNE_POOL_ADDRESS, RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { PricePool, PricePools } from '../../views/pools/Pools.types'
import { GetPoolPeriodEnum, GetPoolsPeriodEnum, PoolAddress, PoolShare, PoolShares, PoolsStateRD } from './types'
import {
  getPricePools,
  pricePoolSelector,
  pricePoolSelectorFromRD,
  getPoolDetail,
  toPoolData,
  filterPoolAssets,
  toPoolsData,
  getPoolAddressesByChain,
  combineShares,
  combineSharesByAsset,
  getPoolAssetsDetail,
  inboundToPoolAddresses,
  getOutboundAssetFeeByChain,
  getSymSharesByAddress,
  poolsPeriodToPoolPeriod,
  getSharesByAssetAndType,
  getPoolAssetDetail
} from './utils'

describe('services/midgard/utils/', () => {
  describe('getPricePools', () => {
    const bsc = { asset: assetToString(AssetBSC), assetDepth: '1', runeDepth: '11' } as PoolDetail
    const eth = { asset: assetToString(AssetETH), assetDepth: '2', runeDepth: '22' } as PoolDetail
    const usdc_bsc = { asset: assetToString(AssetUSDCBSC), assetDepth: '3', runeDepth: '33' } as PoolDetail
    const btc = { asset: assetToString(AssetBTC), assetDepth: '4', runeDepth: '44' } as PoolDetail
    const ltc = { asset: assetToString(AssetLTC), assetDepth: '5', runeDepth: '5' } as PoolDetail
    const usdc = { asset: assetToString(AssetUSDC), assetDepth: '66', runeDepth: '5' } as PoolDetail
    const usdt = { asset: assetToString(AssetUSDTDAC), assetDepth: '77', runeDepth: '5' } as PoolDetail

    it('returns list of price pools in a right order', () => {
      const result = getPricePools([bsc, eth, usdc_bsc, btc, ltc], PRICE_POOLS_WHITELIST)

      // RUNE pool
      const pool0 = result[0]
      expect(pool0.asset).toEqual(AssetRuneNative)
      expect(pool0.poolData.runeBalance.amount().toNumber()).toEqual(ONE_RUNE_BASE_AMOUNT.amount().toNumber())
      expect(pool0.poolData.assetBalance.amount().toNumber()).toEqual(ONE_RUNE_BASE_AMOUNT.amount().toNumber())
      // BTC pool
      const btcPool = result[1]
      expect(btcPool.asset).toEqual(AssetBTC)
      expect(btcPool.poolData.runeBalance.amount().toNumber()).toEqual(44)
      expect(btcPool.poolData.assetBalance.amount().toNumber()).toEqual(4)
      // // ETH pool
      const ethPool = result[2]
      expect(ethPool.asset).toEqual(AssetETH)
      expect(ethPool.poolData.runeBalance.amount().toNumber()).toEqual(22)
      expect(ethPool.poolData.assetBalance.amount().toNumber()).toEqual(2)
      // // AssetUSDCBSC pool
      const usdc_bscPool = result[3]
      expect(usdc_bscPool.asset).toEqual(AssetUSDCBSC)
      expect(usdc_bscPool.poolData.runeBalance.amount().toNumber()).toEqual(33)
      expect(usdc_bscPool.poolData.assetBalance.amount().toNumber()).toEqual(3)
    })

    it('returns RUNE price and btc pools in a right order', () => {
      const result = getPricePools([bsc, ltc, btc], PRICE_POOLS_WHITELIST)
      expect(result.length).toEqual(2)
      // RUNE pool
      const pool0 = result[0]
      expect(pool0.asset).toEqual(AssetRuneNative)
      // BTC pool
      const btcPool = result[1]
      expect(btcPool.asset).toEqual(AssetBTC)
    })

    it('returns RUNE price pool only if another "price" pool is not available', () => {
      const result = getPricePools([bsc, ltc], PRICE_POOLS_WHITELIST)
      expect(result.length).toEqual(1)
      // RUNE pool
      const pool0 = result[0]
      expect(pool0.asset).toEqual(AssetRuneNative)
    })

    it('returns price pools with deepest USD pool included', () => {
      const result = getPricePools([bsc, ltc, usdc, usdt], PRICE_POOLS_WHITELIST)
      expect(result.length).toEqual(2)
      // RUNE pool
      const pool0 = result[0]
      expect(pool0.asset).toEqual(AssetRuneNative)
      // USD pool
      const pool1 = result[1]
      expect(pool1.asset).toEqual(AssetUSDTDAC)
    })
  })

  describe('pricePoolSelector', () => {
    const poolData = toPoolData({ assetDepth: '1', runeDepth: '1' })
    const eth: PricePool = { asset: AssetETH, poolData }
    const BSCUSDC: PricePool = { asset: AssetUSDCBSC, poolData }
    const btc: PricePool = { asset: AssetBTC, poolData }
    const rune: PricePool = RUNE_PRICE_POOL

    it('selects ETH pool', () => {
      const pool = pricePoolSelector([rune, eth, BSCUSDC, btc], O.some(AssetETH))
      expect(pool.asset).toEqual(AssetETH)
    })

    it('selects BUSDBAF pool if ETH pool is not available', () => {
      const pool = pricePoolSelector([rune, BSCUSDC, btc], O.some(AssetETH))
      expect(pool.asset).toEqual(AssetUSDCBSC)
    })

    it('selects BUSDBAF by default if no selection has been done', () => {
      const pool = pricePoolSelector([rune, eth, BSCUSDC, btc], O.none)
      expect(pool.asset).toEqual(AssetUSDCBSC)
    })

    it('selects RUNE if ETH + BUSDBAF pools are not available', () => {
      const pool = pricePoolSelector([rune, btc], O.some(AssetETH))
      expect(pool.asset).toEqual(AssetRuneNative)
    })
  })

  describe('pricePoolSelectorFromRD', () => {
    const poolData = toPoolData({ assetDepth: '1', runeDepth: '1' })
    const eth: PricePool = { asset: AssetETH, poolData }
    const BSCUSDC: PricePool = { asset: AssetUSDCBSC, poolData }
    const btc: PricePool = { asset: AssetBTC, poolData }
    const rune: PricePool = RUNE_PRICE_POOL
    const mockPoolsStateSuccess = (pricePools: PricePools): PoolsStateRD =>
      RD.success({
        assetDetails: [],
        poolAssets: [],
        poolDetails: [],
        poolsData: {},
        pricePools: O.some(pricePools)
      })

    it('selects ETH pool', () => {
      const poolsRD = mockPoolsStateSuccess([rune, eth, BSCUSDC, btc])
      const pool = pricePoolSelectorFromRD(poolsRD, O.some(AssetETH))
      expect(pool.asset).toEqual(AssetETH)
    })

    it('selects BUSDBAF pool if ETH pool is not available', () => {
      const poolsRD = mockPoolsStateSuccess([rune, BSCUSDC, btc])
      const pool = pricePoolSelectorFromRD(poolsRD, O.some(AssetETH))
      expect(pool.asset).toEqual(AssetUSDCBSC)
    })

    it('selects BUSDBAF by default if no selection has been done', () => {
      const poolsRD = mockPoolsStateSuccess([rune, eth, BSCUSDC, btc])
      const pool = pricePoolSelectorFromRD(poolsRD, O.none)
      expect(pool.asset).toEqual(AssetUSDCBSC)
    })
    it('selects RUNE if ETH + BUSDBAF pools are not available', () => {
      const poolsRD = mockPoolsStateSuccess([rune, btc])
      const pool = pricePoolSelectorFromRD(poolsRD, O.some(AssetETH))
      expect(eqAsset.equals(pool.asset, AssetRuneNative)).toBeTruthy()
    })

    it('selects RUNE if no other price pool is available', () => {
      const poolsRD = mockPoolsStateSuccess([rune])
      const pool = pricePoolSelectorFromRD(poolsRD, O.some(AssetETH))
      expect(eqAsset.equals(pool.asset, AssetRuneNative)).toBeTruthy()
    })

    it('selects RUNE pool by default if loading other price pools failed', () => {
      const pool = pricePoolSelectorFromRD(RD.failure(new Error('Could not load pools')), O.none)
      expect(eqAsset.equals(pool.asset, AssetRuneNative)).toBeTruthy()
    })
  })

  describe('getPoolDetail', () => {
    const runeDetail = { asset: assetToString(AssetRuneNative) } as PoolDetail
    const bscDetail = { asset: assetToString(AssetBSC) } as PoolDetail

    it('returns details of RUNE pool', () => {
      const result = getPoolDetail([runeDetail, bscDetail], AssetRuneNative)
      expect(result).toEqual(O.some(runeDetail))
    })

    it('returns None if no RUNE details available', () => {
      const result = getPoolDetail([bscDetail], AssetBTC)
      expect(result).toBeNone()
    })
  })

  describe('getPoolDetailsHashMap', () => {
    const runeDetail = { asset: assetToString(AssetRuneNative) } as PoolDetail
    const bscbDetail = { asset: assetToString(AssetBSC) } as PoolDetail

    it('returns hashMap of pool details', () => {
      const result = toPoolsData([runeDetail, bscbDetail])

      /**
       * Compare stringified structures 'cause
       * Jest compares amount's getter functions by
       * pointers and jest.mock does not work in terms
       * of single describe (only as global mock for file)
       */
      expect(JSON.stringify(result)).toEqual(
        JSON.stringify({
          [assetToString(AssetRuneNative)]: toPoolData(runeDetail),
          [assetToString(AssetBSC)]: toPoolData(bscbDetail)
        })
      )
    })
  })

  describe('filterPoolAssets', () => {
    it('returns empty list', () => {
      expect(filterPoolAssets([])).toEqual([])
    })
  })

  describe('inboundToPoolAddresses', () => {
    it('adds rune pool address empty list', () => {
      expect(inboundToPoolAddresses([])).toEqual([RUNE_POOL_ADDRESS])
    })
    it('adds two `PoolAddress`es', () => {
      const result = inboundToPoolAddresses([{ chain: BSCChain, address: 'bsc-address', router: '', halted: false }])
      expect(result.length).toEqual(2)
      // RUNE `PoolAddress`
      expect(result[0]).toEqual(RUNE_POOL_ADDRESS)
      // bsc `PoolAddress`
      expect(result[1]).toEqual({
        chain: BSCChain,
        address: 'bsc-address',
        router: O.none,
        halted: false
      })
    })
  })

  describe('getPoolAddressesByChain', () => {
    const bscAddress: PoolAddress = { address: 'bsc pool address', chain: BSCChain, router: O.none, halted: false }
    const thorAddress: PoolAddress = { address: 'thor pool address', chain: THORChain, router: O.none, halted: false }
    const btcAddress: PoolAddress = { address: 'btc pool address', chain: BTCChain, router: O.none, halted: false }
    const ethAddress: PoolAddress = { address: '0xaddress', chain: ETHChain, router: O.some('0xrouter'), halted: false }
    const addresses = [bscAddress, thorAddress, btcAddress, ethAddress]

    it('returns BSC pool address ', () => {
      const result = getPoolAddressesByChain(addresses, BSCChain)
      expect(result).toEqual(O.some(bscAddress))
    })

    it('returns ETHs pool address', () => {
      const result = getPoolAddressesByChain(addresses, ETHChain)
      expect(result).toEqual(O.some(ethAddress))
    })

    it('returns none if list of endpoints are empty', () => {
      expect(getPoolAddressesByChain([], BSCChain)).toBeNone()
    })

    it('returns none if chain is not in list of endpoints', () => {
      expect(getPoolAddressesByChain([bscAddress, thorAddress], BTCChain)).toBeNone()
    })
  })

  describe('pool share helpers', () => {
    const ethShare: PoolShare = {
      asset: AssetETH,
      assetAddedAmount: ONE_RUNE_BASE_AMOUNT,
      units: bn('100000000'),
      assetAddress: O.some('eth-address'),
      runeAddress: O.some(RUNE_ADDRESS_TESTNET),
      type: 'sym'
    }
    const bscShare1: PoolShare = {
      asset: AssetBSC,
      assetAddedAmount: TWO_RUNE_BASE_AMOUNT,
      units: bn('200000000'),
      assetAddress: O.some(BSC_ADDRESS_TESTNET),
      runeAddress: O.some(RUNE_ADDRESS_TESTNET),
      type: 'sym'
    }
    const bscShare2: PoolShare = {
      asset: AssetBSC,
      assetAddedAmount: THREE_RUNE_BASE_AMOUNT,
      units: bn('300000000'),
      assetAddress: O.some(BSC_ADDRESS_TESTNET),
      runeAddress: O.none,
      type: 'asym'
    }
    const btcShare: PoolShare = {
      asset: AssetBTC,
      assetAddedAmount: FOUR_RUNE_BASE_AMOUNT,
      units: bn('400000000'),
      assetAddress: O.some('btc-address'),
      runeAddress: O.none,
      type: 'asym'
    }
    const usdcShare: PoolShare = {
      asset: AssetUSDCBSC,
      assetAddedAmount: assetToBase(assetAmount(3)),
      units: bn('300000000'),
      assetAddress: O.some(BSC_ADDRESS_TESTNET),
      runeAddress: O.some(RUNE_ADDRESS_TESTNET),
      type: 'sym'
    }
    const shares: PoolShares = [ethShare, bscShare1, bscShare2, btcShare, usdcShare]

    describe('combineSharesByAsset', () => {
      it('returns none for empty list', () => {
        expect(combineSharesByAsset([], AssetBSC)).toBeNone()
      })

      it('returns none for non existing asset in list', () => {
        expect(combineSharesByAsset([], AssetRuneNative)).toBeNone()
      })
      it('merges BSC pool shares', () => {
        const oResult = combineSharesByAsset(shares, AssetBSC)

        expect(
          FP.pipe(
            oResult,
            O.map((share) =>
              eqPoolShare.equals(share, {
                asset: AssetBSC,
                assetAddedAmount: assetToBase(assetAmount(5)),
                units: bn('500000000'),
                assetAddress: O.some(BSC_ADDRESS_TESTNET),
                runeAddress: O.some(RUNE_ADDRESS_TESTNET),
                type: 'all'
              })
            ),
            O.getOrElse(() => false)
          )
        ).toBeTruthy()
      })

      it('merges ETH pool shares', () => {
        const result = combineSharesByAsset(shares, AssetETH)
        expect(FP.pipe(result, O.toNullable)).toEqual({
          asset: AssetETH,
          units: bn('100000000'),
          assetAddress: O.some('eth-address'),
          runeAddress: O.some(RUNE_ADDRESS_TESTNET),
          assetAddedAmount: ONE_RUNE_BASE_AMOUNT,
          type: 'all'
        })
      })
    })

    describe('combineShares', () => {
      it('returns empty list', () => {
        expect(combineShares([])).toEqual([])
      })
      it('merges pool shares', () => {
        const expected: PoolShares = [
          {
            asset: AssetETH,
            assetAddedAmount: ONE_RUNE_BASE_AMOUNT,
            units: bn('100000000'),
            assetAddress: O.some('eth-address'),
            runeAddress: O.some(RUNE_ADDRESS_TESTNET),
            type: 'all'
          },
          {
            asset: AssetBSC,
            assetAddedAmount: assetToBase(assetAmount(5)),
            units: bn('500000000'),
            assetAddress: O.some(BSC_ADDRESS_TESTNET),
            runeAddress: O.some(RUNE_ADDRESS_TESTNET),
            type: 'all'
          },
          {
            asset: AssetBTC,
            assetAddedAmount: FOUR_RUNE_BASE_AMOUNT,
            assetAddress: O.some('btc-address'),
            runeAddress: O.none,
            units: bn('400000000'),
            type: 'all'
          },
          {
            asset: AssetUSDCBSC,
            assetAddedAmount: assetToBase(assetAmount(3)),
            units: bn('300000000'),
            assetAddress: O.some(BSC_ADDRESS_TESTNET),
            runeAddress: O.some(RUNE_ADDRESS_TESTNET),
            type: 'all'
          }
        ]
        const result = combineShares(shares)
        expect(result.length).toEqual(4)
        expect(eqPoolShares.equals(result, expected)).toBeTruthy()
      })
    })

    describe('getSharesByAssetAndType', () => {
      it('returns none for empty list', () => {
        expect(getSharesByAssetAndType({ shares: [], asset: AssetBSC, type: 'sym' })).toBeNone()
      })

      it('returns none for non existing shares', () => {
        expect(getSharesByAssetAndType({ shares, asset: AssetBTC, type: 'sym' })).toBeNone()
      })

      it('gets sym. shares of BSC pools', () => {
        const oResult = getSharesByAssetAndType({ shares, asset: AssetBSC, type: 'sym' })
        expect(
          FP.pipe(
            oResult,
            O.map((result) => eqPoolShare.equals(result, bscShare1)),
            O.getOrElse(() => false)
          )
        ).toBeTruthy()
      })

      it('gets asym. shares of BSC pools', () => {
        const oResult = getSharesByAssetAndType({ shares, asset: AssetBSC, type: 'asym' })
        expect(
          FP.pipe(
            oResult,
            O.map((result) => eqPoolShare.equals(result, bscShare2)),
            O.getOrElse(() => false)
          )
        ).toBeTruthy()
      })
    })

    describe('getSymSharesByAddress', () => {
      it('returns none for empty list', () => {
        expect(getSymSharesByAddress([], BSC_ADDRESS_TESTNET)).toEqual([])
      })

      it('returns none for non existing address', () => {
        expect(getSymSharesByAddress(shares, 'unknown-address')).toEqual([])
      })

      it('shares of BSC pools', () => {
        const result = getSymSharesByAddress(shares, BSC_ADDRESS_TESTNET)
        expect(result.length).toEqual(2)
        expect(eqPoolShare.equals(result[0], bscShare1)).toBeTruthy()
        expect(eqPoolShare.equals(result[1], usdcShare)).toBeTruthy()
      })

      it('shares of BTC pool', () => {
        const result = getSymSharesByAddress(shares, 'eth-address')
        expect(result.length).toEqual(1)
        expect(eqPoolShare.equals(result[0], ethShare)).toBeTruthy()
      })
    })

    describe('getPoolAssetDetail', () => {
      it('returns none for empty list', () => {
        expect(getPoolAssetDetail({ assetPrice: '1', asset: 'BSC.BNB' })).toEqual(
          O.some({ assetPrice: bn(1), asset: AssetBSC })
        )
      })
      it('returns none for empty data of asset', () => {
        expect(getPoolAssetDetail({ assetPrice: '1', asset: '' })).toBeNone()
      })
    })

    describe('getPoolAssetsDetail', () => {
      it('returns a list of `PoolAssetDetail`s', () => {
        expect(
          getPoolAssetsDetail([
            { assetPrice: '1', asset: 'BSC.BNB' },
            { assetPrice: '2', asset: 'THOR.RUNE' }
          ])
        ).toEqual([
          { assetPrice: bn(1), asset: AssetBSC },
          { assetPrice: bn(2), asset: AssetRuneNative }
        ])
      })
      it('returns empty list in case of invalid data', () => {
        expect(getPoolAssetsDetail([{ assetPrice: '1', asset: '' }])).toEqual([])
      })
    })

    describe('getOutboundAssetFeeByChain', () => {
      const data: { chain: Chain; outbound_fee?: string }[] = [
        { chain: BtcChain, outbound_fee: '1' },
        { chain: ETHChain, outbound_fee: '2' },
        { chain: GAIAChain, outbound_fee: '300' },
        { chain: LTCChain }, // no value
        { chain: BCHChain, outbound_fee: 'invalid' } // invalid value
      ]

      it('BTC', () => {
        const result = getOutboundAssetFeeByChain(data, BTCChain)
        expect(
          eqOAssetWithAmount.equals(
            result,
            O.some({
              asset: AssetBTC,
              amount: baseAmount(1, BTC_DECIMAL)
            })
          )
        ).toBeTruthy()
      })
      it('ETH', () => {
        const result = getOutboundAssetFeeByChain(data, ETHChain)
        expect(
          eqOAssetWithAmount.equals(
            result,
            O.some({
              asset: AssetETH,
              // "2" (1e8) in THORChain will be "20000000000" (1e18) at ETH
              amount: baseAmount(20000000000, ETH_DECIMAL)
            })
          )
        ).toBeTruthy()
      })
      it('Cosmos', () => {
        const result = getOutboundAssetFeeByChain(data, GAIAChain)
        expect(
          eqOAssetWithAmount.equals(
            result,
            O.some({
              asset: AssetATOM,
              // "300" (1e8) in THORChain will be "3" (1e6) at COSMOS
              amount: baseAmount(3, COSMOS_DECIMAL)
            })
          )
        ).toBeTruthy()
      })
      it('none for missing value (LTC)', () => {
        const result = getOutboundAssetFeeByChain(data, LTCChain)
        expect(result).toBeNone()
      })
      it('none for invalid value (BCH)', () => {
        const result = getOutboundAssetFeeByChain(data, BCHChain)
        expect(result).toBeNone()
      })
      it('none for THORChain', () => {
        const result = getOutboundAssetFeeByChain(data, THORChain)
        expect(result).toBeNone()
      })
    })

    describe('poolsPeriodToPoolPeriod', () => {
      it('All', () => {
        const result = poolsPeriodToPoolPeriod(GetPoolsPeriodEnum.All)
        expect(eqString.equals(result, GetPoolPeriodEnum.All)).toBeTruthy()
      })
      it('365d', () => {
        const result = poolsPeriodToPoolPeriod(GetPoolsPeriodEnum._365d)
        expect(eqString.equals(result, GetPoolPeriodEnum._365d)).toBeTruthy()
      })
      it('180d', () => {
        const result = poolsPeriodToPoolPeriod(GetPoolsPeriodEnum._180d)
        expect(eqString.equals(result, GetPoolPeriodEnum._180d)).toBeTruthy()
      })
      it('90d', () => {
        const result = poolsPeriodToPoolPeriod(GetPoolsPeriodEnum._90d)
        expect(eqString.equals(result, GetPoolPeriodEnum._90d)).toBeTruthy()
      })
      it('_30d', () => {
        const result = poolsPeriodToPoolPeriod(GetPoolsPeriodEnum._30d)
        expect(eqString.equals(result, GetPoolPeriodEnum._30d)).toBeTruthy()
      })
      it('7d', () => {
        const result = poolsPeriodToPoolPeriod(GetPoolsPeriodEnum._7d)
        expect(eqString.equals(result, GetPoolPeriodEnum._7d)).toBeTruthy()
      })
      it('24h', () => {
        const result = poolsPeriodToPoolPeriod(GetPoolsPeriodEnum._24h)
        expect(eqString.equals(result, GetPoolPeriodEnum._24h)).toBeTruthy()
      })
      it('1h', () => {
        const result = poolsPeriodToPoolPeriod(GetPoolsPeriodEnum._1h)
        expect(eqString.equals(result, GetPoolPeriodEnum._1h)).toBeTruthy()
      })
    })
  })
})
