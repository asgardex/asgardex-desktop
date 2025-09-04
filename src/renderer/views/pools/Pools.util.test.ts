import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'

import { ASSETS_MAINNET } from '../../../shared/mock/assets'
import { AssetBTC } from '../../../shared/utils/asset'
import { GetPoolsStatusEnum, PoolData } from '../../services/midgard/midgardTypes'
import { LastblockItems } from '../../services/thorchain/types'
import { PoolTableRowData } from './Pools.types'
import {
  getPoolTableRowData,
  getBlocksLeftForPendingPool,
  getBlocksLeftForPendingPoolAsString,
  stringToGetPoolsStatus,
  isEmptyPool
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
})
