import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'

import { ASSETS_MAINNET, ERC20_TESTNET } from '../../../shared/mock/assets'
import { AssetAVAX, AssetBCH, AssetBTC, AssetETH, AssetLTC } from '../../../shared/utils/asset'
import { AssetUSDC, AssetUSDT62E, AssetUSDTDAC } from '../../const'
import { GetPoolsStatusEnum } from '../../services/midgard/types'
import { LastblockItems } from '../../services/thorchain/types'
import { PoolData, PoolTableRowData } from './Pools.types'
import {
  getPoolTableRowData,
  getBlocksLeftForPendingPool,
  getBlocksLeftForPendingPoolAsString,
  filterTableData,
  stringToGetPoolsStatus,
  isEmptyPool,
  FilterTableData
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

  describe('filterTableData', () => {
    const tableData: FilterTableData[] = [
      {
        asset: AssetAVAX
      },
      {
        asset: AssetLTC
      },
      {
        asset: AssetBTC
      },
      {
        asset: AssetBCH
      },
      {
        asset: AssetUSDTDAC // ETH.USDT mainnet
      },
      {
        asset: AssetUSDT62E // ETH.USDT testnet
      },
      {
        asset: AssetUSDC // ETH.USDC mainnet
      },
      {
        asset: ERC20_TESTNET.USDT // Same as AssetUSDT62E
      },
      {
        asset: AssetETH
      },
      {
        asset: {
          chain: BSCChain,
          symbol: 'USDT-0x55d398326f99059fF775485246999027B3197955',
          ticker: 'USDT',
          synth: false
        }
      }
    ] as PoolTableRowData[]

    it('should not filter anything', () => {
      expect(filterTableData()(tableData)).toEqual(tableData)
      expect(filterTableData(O.none)(tableData)).toEqual(tableData)
    })

    it('base', () => {
      expect(filterTableData(O.some('__base__'))(tableData)).toEqual([
        tableData[0],
        tableData[1],
        tableData[2],
        tableData[3],
        tableData[8]
      ])
    })

    it('avax', () => {
      const result = filterTableData(O.some('__avax__'))(tableData)
      expect(result).toEqual([tableData[0]])
    })

    it('erc20', () => {
      const result = filterTableData(O.some('__erc20__'))(tableData)
      expect(result).toEqual([tableData[4], tableData[5], tableData[6], tableData[7]])
    })

    it('usd', () => {
      expect(filterTableData(O.some('__usd__'))(tableData)).toEqual([
        tableData[4],
        tableData[5],
        tableData[6],
        tableData[7],
        tableData[9]
      ])
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
