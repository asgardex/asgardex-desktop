import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { AnyAsset, assetAmount, assetToBase, AssetType } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'

import { ASSETS_MAINNET } from '../../../shared/mock/assets'
import { AssetBTC, AssetCacao, AssetRuneNative } from '../../../shared/utils/asset'
import { GetPoolsStatusEnum, PoolData } from '../../services/midgard/midgardTypes'
import { LastblockItems } from '../../services/thorchain/types'
import { PoolTableRowData } from './Pools.types'
import {
  getPoolTableRowData,
  getBlocksLeftForPendingPool,
  getBlocksLeftForPendingPoolAsString,
  stringToGetPoolsStatus,
  isEmptyPool,
  formatCompactNumber,
  formatCompactAmount,
  formatPoolPrice,
  formatPoolApy,
  sortPoolRows
} from './Pools.utils'

describe('views/pools/utils', () => {
  describe('getPoolTableRowData', () => {
    const lokPoolDetail = {
      asset: 'DOGE.DOGE',
      assetDepth: '11000000000',
      runeDepth: '10000000000',
      volume24h: '10000000000',
      poolAPY: '0.02',
      status: GetPoolsStatusEnum.Staged
    } as PoolDetail

    const pricePoolData: PoolData = {
      dexBalance: assetToBase(assetAmount(10)),
      assetBalance: assetToBase(assetAmount(100))
    }

    it('transforms data for a DOGE pool', () => {
      const expected: PoolTableRowData = {
        asset: ASSETS_MAINNET.DOGE,
        poolPrice: assetToBase(assetAmount(2)),
        depthAmount: assetToBase(assetAmount(220)),
        depthPrice: assetToBase(assetAmount(2000)),
        volumeAmount: assetToBase(assetAmount(110)),
        volumePrice: assetToBase(assetAmount(1000)),
        status: GetPoolsStatusEnum.Available,
        deepest: false,
        apy: 2,
        key: 'hi',
        network: Network.Testnet,
        watched: false
      }

      const result = getPoolTableRowData({
        poolDetail: lokPoolDetail,
        pricePoolData: pricePoolData,
        watchlist: [],
        network: Network.Testnet
      })

      expect(O.isSome(result)).toBeTruthy()
      FP.pipe(
        result,
        O.map((data) => {
          expect(data.asset).toEqual(expected.asset)
          expect(data.asset).toEqual(expected.asset)
          expect(data.depthPrice.eq(expected.depthPrice)).toBeTruthy()
          expect(data.depthAmount.eq(expected.depthAmount)).toBeTruthy()
          expect(data.volumePrice.eq(expected.volumePrice)).toBeTruthy()
          expect(data.volumeAmount.eq(expected.volumeAmount)).toBeTruthy()
          expect(data.apy).toEqual(expected.apy)
          return true
        })
      )
    })
  })

  describe('getBlocksLeftForPendingPool', () => {
    const oNewPoolCycle = O.some(3001)
    const lastblock = [
      {
        thorchain: 2000,
        chain: BTCChain
      }
    ]
    it('returns number of blocks left', () => {
      const result = O.toNullable(getBlocksLeftForPendingPool(lastblock, AssetBTC, oNewPoolCycle))
      expect(result).toEqual(1001)
    })
    it('returns None if NewPoolCycle is not available', () => {
      const result = getBlocksLeftForPendingPool(lastblock, AssetBTC, O.none)
      expect(result).toBeNone()
    })
    it('returns NOne if lastblock (thorchain) is not available', () => {
      const lastblock2: LastblockItems = []
      const result = getBlocksLeftForPendingPool(lastblock2, AssetBTC, oNewPoolCycle)
      expect(result).toBeNone()
    })
  })

  describe('getBlocksLeftForPendingPoolAsString', () => {
    const oNewPoolCycle = O.some(1234)
    const lastblock = [
      {
        thorchain: 1000,
        chain: BTCChain
      }
    ]
    it('returns number of blocks left', () => {
      const result = getBlocksLeftForPendingPoolAsString(lastblock, AssetBTC, oNewPoolCycle)
      expect(result).toEqual('234')
    })
    it('returns empty string if NewPoolCycle is not available', () => {
      const result = getBlocksLeftForPendingPoolAsString(lastblock, AssetBTC, O.none)
      expect(result).toEqual('')
    })
    it('returns empty string if lastblock (thorchain) is not available', () => {
      const lastblock2: LastblockItems = []
      const result = getBlocksLeftForPendingPoolAsString(lastblock2, AssetBTC, oNewPoolCycle)
      expect(result).toEqual('')
    })
  })

  describe('stringToGetPoolsStatus', () => {
    it('suspended', () => {
      const status = 'suspended'
      const result = stringToGetPoolsStatus(status)
      expect(result).toEqual(GetPoolsStatusEnum.Suspended)
    })

    it('available', () => {
      const status = 'available'
      const result = stringToGetPoolsStatus(status)
      expect(result).toEqual(GetPoolsStatusEnum.Available)
    })

    it('staged', () => {
      const status = 'staged'
      const result = stringToGetPoolsStatus(status)
      expect(result).toEqual(GetPoolsStatusEnum.Staged)
    })

    it('suspended for others', () => {
      const status = 'other'
      const result = stringToGetPoolsStatus(status)
      expect(result).toEqual(GetPoolsStatusEnum.Suspended)
    })
  })

  describe('isEmptyPool', () => {
    it('empty if assetDepth and runeDepth are zero', () => {
      expect(isEmptyPool({ assetDepth: '0', runeDepth: '0' })).toBeTruthy()
    })
    it('empty if assetDepth is zero', () => {
      expect(isEmptyPool({ assetDepth: '0', runeDepth: '100' })).toBeTruthy()
    })
    it('empty if runeDepth is zero', () => {
      expect(isEmptyPool({ assetDepth: '100', runeDepth: '0' })).toBeTruthy()
    })
    it('not empty if assetDepth and runeDepth are NOT zero', () => {
      expect(isEmptyPool({ assetDepth: '100', runeDepth: '200' })).toBeFalsy()
    })
  })

  describe('formatting', () => {
    const USD: AnyAsset = { chain: 'ETH', symbol: 'USDT-0XDAC17', ticker: 'USDT', type: AssetType.TOKEN }
    const amount = (value: number) => assetToBase(assetAmount(value))

    it('formatCompactNumber', () => {
      expect(formatCompactNumber(0)).toBe('0.00')
      expect(formatCompactNumber(12.3)).toBe('12.30')
      expect(formatCompactNumber(961_650)).toBe('961.65K')
      expect(formatCompactNumber(27_614_000)).toBe('27.61M')
      expect(formatCompactNumber(1_500_000_000)).toBe('1.50B')
      expect(formatCompactNumber(2_000_000_000_000)).toBe('2.00T')
    })

    it('formatCompactAmount uses a currency symbol as prefix and a ticker as suffix', () => {
      expect(formatCompactAmount(amount(27_614_000), USD)).toBe('$27.61M')
      expect(formatCompactAmount(amount(1_234), AssetRuneNative)).toBe('ᚱ1.23K')
      expect(formatCompactAmount(amount(1_234), AssetCacao)).toBe('1.23K CACAO')
    })

    it('formatPoolPrice adapts decimals to the size of a price', () => {
      expect(formatPoolPrice(amount(75_193.824), USD)).toBe('$75,193.82')
      expect(formatPoolPrice(amount(241.0912), USD)).toBe('$241.091')
      expect(formatPoolPrice(amount(1), USD)).toBe('$1.000')
      expect(formatPoolPrice(amount(0.94041), USD)).toBe('$0.9404')
      expect(formatPoolPrice(amount(0.00033211), USD)).toBe('$0.0003321')
      expect(formatPoolPrice(amount(0), USD)).toBe('$0')
      expect(formatPoolPrice(amount(2.5), AssetCacao)).toBe('2.500 CACAO')
    })

    it('formatPoolApy', () => {
      expect(formatPoolApy(5.284)).toBe('5.28%')
      expect(formatPoolApy(0)).toBe('0.00%')
    })
  })

  describe('sortPoolRows', () => {
    const row = (asset: AnyAsset, price: number, depth: number, volume: number, apy: number): PoolTableRowData => ({
      asset,
      poolPrice: assetToBase(assetAmount(price)),
      depthAmount: assetToBase(assetAmount(0)),
      depthPrice: assetToBase(assetAmount(depth)),
      volumeAmount: assetToBase(assetAmount(0)),
      volumePrice: assetToBase(assetAmount(volume)),
      apy,
      status: GetPoolsStatusEnum.Available,
      key: asset.ticker,
      network: Network.Mainnet,
      watched: false
    })
    const btc = row(ASSETS_MAINNET.BTC, 75_000, 100, 30, 5)
    const eth = row(ASSETS_MAINNET.ETH, 2_000, 300, 10, 11)
    const doge = row(ASSETS_MAINNET.DOGE, 0.07, 50, 20, 11)
    const tickers = (rows: PoolTableRowData[]) => rows.map(({ asset }) => asset.ticker)

    it('sorts by liquidity', () => {
      expect(tickers(sortPoolRows([btc, eth, doge], { key: 'depthPrice', direction: 'desc' }))).toEqual([
        'ETH',
        'BTC',
        'DOGE'
      ])
      expect(tickers(sortPoolRows([btc, eth, doge], { key: 'depthPrice', direction: 'asc' }))).toEqual([
        'DOGE',
        'BTC',
        'ETH'
      ])
    })

    it('sorts by price, volume and pool name', () => {
      expect(tickers(sortPoolRows([doge, btc, eth], { key: 'poolPrice', direction: 'desc' }))).toEqual([
        'BTC',
        'ETH',
        'DOGE'
      ])
      expect(tickers(sortPoolRows([doge, btc, eth], { key: 'volumePrice', direction: 'desc' }))).toEqual([
        'BTC',
        'DOGE',
        'ETH'
      ])
      expect(tickers(sortPoolRows([doge, btc, eth], { key: 'asset', direction: 'asc' }))).toEqual([
        'BTC',
        'DOGE',
        'ETH'
      ])
    })

    it('keeps the order of equal rows (stable) in both directions', () => {
      expect(tickers(sortPoolRows([eth, btc, doge], { key: 'apy', direction: 'desc' }))).toEqual(['ETH', 'DOGE', 'BTC'])
      expect(tickers(sortPoolRows([doge, btc, eth], { key: 'apy', direction: 'asc' }))).toEqual(['BTC', 'DOGE', 'ETH'])
    })

    it('does not mutate the input', () => {
      const rows = [btc, eth, doge]
      sortPoolRows(rows, { key: 'apy', direction: 'desc' })
      expect(tickers(rows)).toEqual(['BTC', 'ETH', 'DOGE'])
    })
  })
})
