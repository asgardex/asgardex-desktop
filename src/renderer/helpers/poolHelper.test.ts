import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Balance, Network } from '@xchainjs/xchain-client'

import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import {
  AnyAsset,
  assetAmount,
  assetFromStringEx,
  assetToBase,
  assetToString,
  baseAmount,
  Chain
} from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'

import { PoolsWatchList } from '../../shared/api/io'
import { ASSETS_MAINNET } from '../../shared/mock/assets'
import {
  AssetAETH,
  AssetATOM,
  AssetAVAX,
  AssetBCH,
  AssetBSC,
  AssetBTC,
  AssetDOGE,
  AssetETH,
  AssetLTC,
  AssetRuneNative
} from '../../shared/utils/asset'
import { DEFAULT_ENABLED_CHAINS } from '../../shared/utils/chain'
import { ARBChain, AVAXChain, GAIAChain } from '../../shared/utils/chainIds'
import { AssetUSDCAVAX, AssetUSDTBSC } from '../const'
import mayaLastblock from '../hooks/__fixtures__/mayanode-mainnet-btc-eth-zec-trading-halted/lastblock.json'
import mayaMimir from '../hooks/__fixtures__/mayanode-mainnet-btc-eth-zec-trading-halted/mimir.json'
import thorLastblock from '../hooks/__fixtures__/thornode-mainnet-chains-halted-lp-paused/lastblock.json'
import thorMimir from '../hooks/__fixtures__/thornode-mainnet-chains-halted-lp-paused/mimir.json'
import { getThorchainMimirHalt } from '../hooks/useMimirHalt'
import { getMayachainMimirHalt } from '../hooks/useMimirHaltMaya'
import { Mimir as MimirMaya } from '../services/mayachain/types'
import { GetPoolsStatusEnum, PoolData, PoolDetails, PricePool } from '../services/midgard/midgardTypes'
import { toPoolData } from '../services/midgard/thorMidgard/utils'
import { DEFAULT_MIMIR_HALT } from '../services/thorchain/const'
import { Mimir, MimirHalt } from '../services/thorchain/types'
import {
  disableAllActions,
  disablePoolActions,
  disableTradingActions,
  disableWithdrawActions,
  getDeepestPool,
  getPoolPriceValue,
  getPoolTableRowsData
} from './poolHelper'
import * as PoolHelpersMaya from './poolHelperMaya'

describe('helpers/poolHelper/', () => {
  const mockPoolDetail: PoolDetail = {
    asset: assetToString(AssetBSC),
    assetDepth: '0',
    assetPrice: '0',
    assetPriceUSD: '0',
    poolAPY: '0',
    runeDepth: '0',
    status: GetPoolsStatusEnum.Staged,
    units: '0',
    volume24h: '0',
    liquidityUnits: '0',
    synthUnits: '0',
    synthSupply: '0',
    annualPercentageRate: '0',
    nativeDecimal: '0',
    saversDepth: '0',
    saversUnits: '0',
    saversAPR: '0',
    totalCollateral: '0',
    totalDebtTor: '0',
    earnings: '0',
    earningsAnnualAsPercentOfDepth: '0',
    lpLuvi: '0'
  }
  const pool1: PoolDetail = { ...mockPoolDetail, status: GetPoolsStatusEnum.Staged, runeDepth: '1000' }
  const pool2: PoolDetail = { ...mockPoolDetail, status: GetPoolsStatusEnum.Available, runeDepth: '2000' }
  const pool3: PoolDetail = { ...mockPoolDetail, status: GetPoolsStatusEnum.Suspended, runeDepth: '0' }
  const pool4: PoolDetail = { ...mockPoolDetail, status: GetPoolsStatusEnum.Staged, runeDepth: '4000' }

  const watchlist: PoolsWatchList = [AssetBSC]

  describe('getDeepestPool', () => {
    it('returns deepest pool', () => {
      const pools = [pool1, pool2, pool4, pool3]
      const result = getDeepestPool(pools)
      expect(result).toEqual(O.some(pool4))
    })

    it('does not return a deepest pool by given an empty list of pools', () => {
      const pools: PoolDetails = []
      const result = getDeepestPool(pools)
      expect(result).toBeNone()
    })
  })

  describe('getPoolTableRowsData', () => {
    const poolDetails: PoolDetails = [
      { ...mockPoolDetail, asset: assetToString(ASSETS_MAINNET.ETH), status: GetPoolsStatusEnum.Available },
      { ...mockPoolDetail, asset: assetToString(ASSETS_MAINNET.BTC), status: GetPoolsStatusEnum.Available }
    ]
    const pendingPoolDetails: PoolDetails = [
      { ...mockPoolDetail, asset: assetToString(ASSETS_MAINNET.DOGE), status: GetPoolsStatusEnum.Staged },
      { ...mockPoolDetail, asset: assetToString(ASSETS_MAINNET.BTC), status: GetPoolsStatusEnum.Staged }
    ]

    const pricePoolData: PoolData = {
      dexBalance: assetToBase(assetAmount(110)),
      assetBalance: assetToBase(assetAmount(100))
    }

    it('returns data for pending pools', () => {
      const result = getPoolTableRowsData({
        poolDetails: pendingPoolDetails,
        pricePoolData,
        watchlist,
        network: Network.Testnet
      })
      expect(result.length).toEqual(2)
      // Note: `getPoolTableRowsData` reverses the order of given `poolDetails`
      expect(result[0].asset).toEqual(ASSETS_MAINNET.BTC)
      expect(result[1].asset).toEqual(ASSETS_MAINNET.DOGE)
    })

    it('returns data for available pools', () => {
      const result = getPoolTableRowsData({
        poolDetails,
        pricePoolData,
        watchlist,
        network: Network.Testnet
      })
      expect(result.length).toEqual(2)
      // Note: `getPoolTableRowsData` reverses the order of given `poolDetails`
      expect(result[0].asset).toEqual(ASSETS_MAINNET.BTC)
      expect(result[1].asset).toEqual(ASSETS_MAINNET.ETH)
    })
  })

  describe('toPoolData', () => {
    const poolDetail: PoolDetail = {
      ...mockPoolDetail,
      assetDepth: '11000000000',
      runeDepth: '10000000000'
    }

    it('transforms `PoolData', () => {
      const result = toPoolData(poolDetail)
      expect(result.assetBalance.amount().toNumber()).toEqual(11000000000)
      expect(result.dexBalance.amount().toNumber()).toEqual(10000000000)
    })
  })

  describe('getPoolPriceValue', () => {
    const poolDetails: PoolDetails = [
      {
        ...mockPoolDetail,
        asset: assetToString(AssetBSC),
        assetDepth: '1000000000',
        runeDepth: '10000000000'
      }
    ]

    const usdPricePool: PricePool = {
      asset: AssetUSDTBSC,
      poolData: {
        assetBalance: assetToBase(assetAmount(110000)),
        dexBalance: assetToBase(assetAmount(100000))
      }
    }

    it('returns a price for BSC in USD', () => {
      const balance: Balance = {
        amount: baseAmount('1'),
        asset: AssetBSC
      }
      const result = FP.pipe(
        getPoolPriceValue({ balance, poolDetails, pricePool: usdPricePool }),
        O.fold(
          () => 'failure',
          (price) => price.amount().toString()
        )
      )
      expect(result).toEqual('11')
    })

    it('returns a price for RUNE in USD', () => {
      const balance: Balance = {
        amount: baseAmount('1'),
        asset: AssetRuneNative
      }
      const result = FP.pipe(
        getPoolPriceValue({ balance, poolDetails: [], pricePool: usdPricePool }),
        O.fold(
          () => 'failure',
          (price) => price.amount().toString()
        )
      )
      expect(result).toEqual('1')
    })

    it('returns a no price if no pools are available', () => {
      const balance: Balance = {
        amount: baseAmount('1'),
        asset: AssetBSC
      }
      const result = getPoolPriceValue({ balance, poolDetails: [], pricePool: usdPricePool })
      expect(result).toBeNone()
    })
  })

  describe('disableAllActions', () => {
    const haltedChains: Chain[] = [ETHChain, BSCChain]
    it('true for any chain if THORChain is halted', () => {
      const result = disableAllActions({
        chain: BSCChain,
        haltedChains,
        mimirHalt: { ...DEFAULT_MIMIR_HALT, HALTTHORCHAIN: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if chain is not in halted list, but THORChain is halted', () => {
      const result = disableAllActions({
        chain: LTCChain,
        haltedChains,
        mimirHalt: { ...DEFAULT_MIMIR_HALT, HALTTHORCHAIN: true }
      })
      expect(result).toBeTruthy()
    })
    it('true for ETH if ETH chain is halted', () => {
      const result = disableAllActions({
        chain: ETHChain,
        haltedChains,
        mimirHalt: { ...DEFAULT_MIMIR_HALT, HALTETHCHAIN: true }
      })
      expect(result).toBeTruthy()
    })
    it('false for a chain, if it is not in halted list, but ETH chain is halted', () => {
      const result = disableAllActions({
        chain: LTCChain,
        haltedChains,
        mimirHalt: { ...DEFAULT_MIMIR_HALT, HALTETHCHAIN: true }
      })
      expect(result).toBeFalsy()
    })
    it('true if ETH is in halted list, but no mimir halt', () => {
      const result = disableAllActions({
        chain: ETHChain,
        haltedChains,
        mimirHalt: DEFAULT_MIMIR_HALT
      })
      expect(result).toBeTruthy()
    })
    it('true if BSC is in halted list, but no mimir halt', () => {
      const result = disableAllActions({
        chain: BSCChain,
        haltedChains,
        mimirHalt: DEFAULT_MIMIR_HALT
      })
      expect(result).toBeTruthy()
    })
    it('false if no mimir halt + chain is not in halted list', () => {
      const result = disableAllActions({
        chain: LTCChain,
        haltedChains,
        mimirHalt: DEFAULT_MIMIR_HALT
      })
      expect(result).toBeFalsy()
    })
  })

  describe('disableTradingActions', () => {
    const haltedChains: Chain[] = [ETHChain, BSCChain]
    it('true for any chain if trading is halted', () => {
      const result = disableTradingActions({
        chain: BSCChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT,
          haltGlobalTrading: true
        }
      })
      expect(result).toBeTruthy()
    })
    it('true if chain is not in halted list, but trading is halted', () => {
      const result = disableTradingActions({
        chain: LTCChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT,
          haltGlobalTrading: true
        }
      })
      expect(result).toBeTruthy()
    })
    it('true for BTC if BTC trading is halted', () => {
      const result = disableTradingActions({
        chain: BTCChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT,
          HALTBTCTRADING: true
        }
      })
      expect(result).toBeTruthy()
    })
    it('true for ETH if ETH trading is halted', () => {
      const result = disableTradingActions({
        chain: ETHChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT,
          HALTETHTRADING: true
        }
      })
      expect(result).toBeTruthy()
    })
    it('true for BCH if BCH trading is halted', () => {
      const result = disableTradingActions({
        chain: BCHChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT,
          HALTBCHTRADING: true
        }
      })
      expect(result).toBeTruthy()
    })
    it('true for LTC if LTC trading is halted', () => {
      const result = disableTradingActions({
        chain: LTCChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT,
          HALTLTCTRADING: true
        }
      })
      expect(result).toBeTruthy()
    })
    it('true for DOGE if DOGE trading is halted', () => {
      const result = disableTradingActions({
        chain: DOGEChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT,
          HALTDOGETRADING: true
        }
      })
      expect(result).toBeTruthy()
    })

    it('true for BSC if BSC trading is halted', () => {
      const result = disableTradingActions({
        chain: BSCChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT,
          HALTBSCTRADING: true
        }
      })
      expect(result).toBeTruthy()
    })

    it('true for Cosmos if Cosmos trading is halted', () => {
      const result = disableTradingActions({
        chain: GAIAChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT,
          HALTGAIATRADING: true
        }
      })
      expect(result).toBeTruthy()
    })
    it('false for a chain, if it is not in halted list, but other chains have trading halted', () => {
      const result = disableTradingActions({
        chain: LTCChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT,
          HALTBTCTRADING: true,
          HALTETHTRADING: true,
          HALTBCHTRADING: true,
          HALTBSCTRADING: true,
          HALTGAIATRADING: true
        }
      })
      expect(result).toBeFalsy()
    })
    it('true if ETH is in halted list, but no mimir trading halt', () => {
      const result = disableTradingActions({
        chain: ETHChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT
        }
      })
      expect(result).toBeTruthy()
    })
    it('true if BSC is in halted list, but no mimir trading halt', () => {
      const result = disableTradingActions({
        chain: BSCChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT
        }
      })
      expect(result).toBeTruthy()
    })
    it('false if no mimir trading halt + chain is not in halted list', () => {
      const result = disableTradingActions({
        chain: LTCChain,
        haltedChains,
        mimirHalt: {
          ...DEFAULT_MIMIR_HALT,
          HALTETHTRADING: true
        }
      })
      expect(result).toBeFalsy()
    })
  })

  describe('disablePoolActions', () => {
    it.each([
      [AssetBSC, 'PAUSELPDEPOSIT-BSC-BNB'],
      [AssetATOM, 'PAUSELPDEPOSIT-GAIA-ATOM']
    ])('true for %s with only the gas-pool deposit pause %s set', (asset, key) => {
      const mimirHalt = { ...DEFAULT_MIMIR_HALT, [key]: true }
      expect(disablePoolActions({ asset, haltedChains: [], mimirHalt })).toBe(true)
      // deposit pause never blocks withdraw
      expect(disableWithdrawActions({ chain: asset.chain, haltedChains: [], mimirHalt })).toBe(false)
    })

    it('gas-pool deposit pause blocks only that pool, not other pools of the chain', () => {
      const mimirHalt = { ...DEFAULT_MIMIR_HALT, 'PAUSELPDEPOSIT-BSC-BNB': true }
      // THORNode scopes PAUSELPDEPOSIT-<CHAIN>-<SYMBOL> to one pool
      expect(disablePoolActions({ asset: AssetUSDTBSC, haltedChains: [], mimirHalt })).toBe(false)
      expect(disablePoolActions({ asset: AssetBSC, haltedChains: [], mimirHalt })).toBe(true)
    })

    it('true if trading is halted for this chain', () => {
      const result = disablePoolActions({
        asset: AssetBTC,
        haltedChains: [ETHChain, BTCChain],
        mimirHalt: { ...DEFAULT_MIMIR_HALT }
      })
      expect(result).toBeTruthy()
    })

    it('true if LP is paused', () => {
      const result = disablePoolActions({
        asset: AssetBTC,
        haltedChains: [ETHChain, BTCChain],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, pauseGlobalLp: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if BTC chain is not in halted list, but paused', () => {
      const result = disablePoolActions({
        asset: AssetBTC,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, PAUSELPBTC: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if BTC chain is not in halted list, but LP paused', () => {
      const result = disablePoolActions({
        asset: AssetBTC,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, pauseGlobalLp: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if BTC chain is not in halted list, but paused', () => {
      const result = disablePoolActions({
        asset: AssetBTC,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, PAUSELPBTC: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if BTC chain is not in halted list, but LP paused', () => {
      const result = disablePoolActions({
        asset: AssetBTC,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, pauseGlobalLp: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if BCH chain is not in halted list, but paused', () => {
      const result = disablePoolActions({
        asset: AssetBCH,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, PAUSELPBCH: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if BCH chain is not in halted list, but LP paused', () => {
      const result = disablePoolActions({
        asset: AssetBCH,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, pauseGlobalLp: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if ETH chain is not in halted list, but paused', () => {
      const result = disablePoolActions({
        asset: AssetETH,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, PAUSELPETH: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if ETH chain is not in halted list, but LP paused', () => {
      const result = disablePoolActions({
        asset: AssetETH,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, pauseGlobalLp: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if LTC chain is not in halted list, but paused', () => {
      const result = disablePoolActions({
        asset: AssetLTC,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, PAUSELPLTC: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if LTC chain is not in halted list, but LP paused', () => {
      const result = disablePoolActions({
        asset: AssetLTC,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, pauseGlobalLp: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if DOGE chain is not in halted list, but paused', () => {
      const result = disablePoolActions({
        asset: AssetDOGE,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, PAUSELPDOGE: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if DOGE chain is not in halted list, but LP paused', () => {
      const result = disablePoolActions({
        asset: AssetDOGE,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, pauseGlobalLp: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if Cosmos chain is not in halted list, but paused', () => {
      const result = disablePoolActions({
        asset: AssetATOM,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, PAUSELPGAIA: true }
      })
      expect(result).toBeTruthy()
    })
    it('true if Cosmos chain is not in halted list, but LP paused', () => {
      const result = disablePoolActions({
        asset: AssetATOM,
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, pauseGlobalLp: true }
      })
      expect(result).toBeTruthy()
    })
  })

  // On/off matrix of the LP pause and halt codes, built on the live mimir fixtures
  // (hooks/__fixtures__, see their README.md). Each action is composed the way the app composes it:
  // Add = SymDepositView.tsx (disableAllActions || disableTradingActions || disablePoolActions),
  // Withdraw = Withdraw.tsx (THOR disableAllActions || disableWithdrawActions, for both protocols),
  // Swap = SwapView.tsx / protocolTradingHalt.ts (disableAllActions || disableTradingActions).
  // Expected values come from the doc tables above each helper: true = blocked, false = open.
  // A string marks a cell where the doc table and the code disagree; it is not asserted
  // (see feeds/flux-lp-halt-matrix-*.md): D1/D2 PAUSELP / PAUSELP{chain} withdraw, D3 PAUSELPDEPOSIT swap,
  // D4 HALTMAYACHAIN withdraw.
  describe('LP pause and halt codes: on/off matrix on the mimir fixtures', () => {
    type Cell = boolean | 'D1' | 'D2' | 'D3' | 'D4'
    type Cells = { add: Cell; withdraw: Cell; swap: Cell }
    type Actions = { add: boolean; withdraw: boolean; swap: boolean }
    type CodeExpect = { gas: Cells; token: Cells }
    const ALL: Cells = { add: true, withdraw: true, swap: true }
    const TRADING: Cells = { add: true, withdraw: false, swap: true }
    const OPEN: Cells = { add: false, withdraw: false, swap: false }

    // A cell is blocked if any active code blocks it, unasserted if any active code is disputed, else open
    const combine = (cells: Cells[]): Cells => {
      const pick = (key: keyof Cells): Cell =>
        cells.some((c) => c[key] === true)
          ? true
          : (cells.map((c) => c[key]).find((c): c is Exclude<Cell, boolean> => typeof c === 'string') ?? false)
      return { add: pick('add'), withdraw: pick('withdraw'), swap: pick('swap') }
    }
    const agreed = (expected: Cells, actual: Actions) => ({
      expected: Object.fromEntries(Object.entries(expected).filter(([, v]) => typeof v === 'boolean')),
      actual: Object.fromEntries(
        Object.entries(actual).filter(([k]) => typeof expected[k as keyof Cells] === 'boolean')
      )
    })

    const INBOUND = 'inbound_addresses halted'
    type State = { mimir: Record<string, number>; haltedChains: Chain[] }
    const toggle =
      (inboundChain: Chain) =>
      ({ mimir, haltedChains }: State, code: string, on: boolean): State =>
        code === INBOUND
          ? { mimir, haltedChains: on ? [inboundChain] : [] }
          : { mimir: { ...mimir, [code]: on ? 1 : 0 }, haltedChains }

    // Rows: each code on and off alone (others as in the snapshot), then every pair on
    const matrixRows = (codes: string[], onInSnapshot: string[]): Array<[string, string[]]> => [
      ...codes.flatMap((code): Array<[string, string[]]> => [
        [`${code} on`, [...onInSnapshot.filter((c) => c !== code), code]],
        [`${code} off`, onInSnapshot.filter((c) => c !== code)]
      ]),
      ...codes.flatMap((a, i) =>
        codes
          .slice(i + 1)
          .map((b): [string, string[]] => [`${a} + ${b} on`, [...onInSnapshot.filter((c) => c !== a && c !== b), a, b]])
      )
    ]

    describe('THORChain (thornode-mainnet-chains-halted-lp-paused, height 28483475)', () => {
      const snapshot: Mimir = thorMimir
      const lastHeight = thorLastblock.find(({ thorchain }) => thorchain > 0)?.thorchain ?? 0
      const chains = Object.keys(DEFAULT_ENABLED_CHAINS)
      const snapshotHalt = getThorchainMimirHalt({ mimir: snapshot, lastHeight, chains })

      const actions = (asset: AnyAsset, { mimir, haltedChains }: State): Actions => {
        const mimirHalt = getThorchainMimirHalt({ mimir, lastHeight, chains })
        const { chain } = asset
        const all = disableAllActions({ chain, haltedChains, mimirHalt })
        const trading = disableTradingActions({ chain, haltedChains, mimirHalt })
        return {
          add: all || trading || disablePoolActions({ asset, haltedChains, mimirHalt }),
          withdraw: all || disableWithdrawActions({ chain, haltedChains, mimirHalt }),
          swap: all || trading
        }
      }

      const depositKeys = Object.entries(snapshot).filter(([key]) => key.startsWith('PAUSELPDEPOSIT-'))

      it('snapshot has 33 PAUSELPDEPOSIT keys, 24 of them set', () => {
        expect(depositKeys.length).toBe(33)
        expect(depositKeys.filter(([, value]) => value > 0).length).toBe(24)
      })

      // THORNode IsPoolDepositPaused: value > 0 blocks deposits into that one pool (keeper_halt.go)
      it.each(depositKeys)('disablePoolActions for the pool of %s = %s', (key, value) => {
        const [, chain, ...symbol] = key.split('-')
        const asset = assetFromStringEx(`${chain}.${symbol.join('-')}`)
        expect(disablePoolActions({ asset, haltedChains: [], mimirHalt: snapshotHalt })).toBe(value > 0)
      })

      // AVAX is not halted in the snapshot (BSC is, by HALTBSCCHAIN = 1), so the matrix runs on AVAX:
      // gas pool AVAX.AVAX, token pool AVAX.USDC-0XB97E…
      const gasKey = 'PAUSELPDEPOSIT-AVAX-AVAX'
      const tokenKey = 'PAUSELPDEPOSIT-AVAX-USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E'
      const EXPECT: Record<string, CodeExpect> = {
        // poolHelper.ts table rows PAUSELP (global) / PAUSELP{chain}: ADD NO, WITHDRAW YES, SWAP YES
        PAUSELP: { gas: { add: true, withdraw: 'D1', swap: false }, token: { add: true, withdraw: 'D1', swap: false } },
        PAUSELPAVAX: {
          gas: { add: true, withdraw: 'D2', swap: false },
          token: { add: true, withdraw: 'D2', swap: false }
        },
        // halt{chain}Chain: ADD NO, WITHDRAW NO, SWAP NO
        HALTAVAXCHAIN: { gas: ALL, token: ALL },
        // HALT{chain} (in haltedChains): ADD NO, WITHDRAW NO, SWAP NO
        [INBOUND]: { gas: ALL, token: ALL },
        // halt{chain}Trading: ADD NO, WITHDRAW YES, SWAP NO
        HALTAVAXTRADING: { gas: TRADING, token: TRADING },
        // haltTrading (global), disableTradingActions step 1
        HALTTRADING: { gas: TRADING, token: TRADING },
        // HALTTHORCHAIN, disableAllActions
        HALTTHORCHAIN: { gas: ALL, token: ALL },
        // PAUSELPDEPOSIT-{chain}-{symbol}: ADD NO, WITHDRAW YES, SWAP NO; scoped to one pool
        [gasKey]: { gas: { add: true, withdraw: false, swap: 'D3' }, token: OPEN },
        [tokenKey]: { gas: OPEN, token: { add: true, withdraw: false, swap: 'D3' } }
      }
      const codes = Object.keys(EXPECT)
      const onInSnapshot = [gasKey]
      const base: State = { mimir: snapshot, haltedChains: [] }

      it('matrix codes are as expected in the snapshot (only the AVAX.AVAX deposit pause is on)', () => {
        expect(codes.filter((c) => c !== INBOUND).map((c) => [c, snapshot[c]])).toEqual(
          codes.filter((c) => c !== INBOUND).map((c) => [c, onInSnapshot.includes(c) ? 1 : 0])
        )
      })

      it.each(matrixRows(codes, onInSnapshot))('AVAX: %s', (_, on) => {
        const state = codes.reduce((s, code) => toggle(AVAXChain)(s, code, on.includes(code)), base)
        const result = (pool: keyof CodeExpect, asset: AnyAsset) =>
          agreed(combine(on.map((code) => EXPECT[code][pool])), actions(asset, state))
        const gas = result('gas', AssetAVAX)
        const token = result('token', AssetUSDCAVAX)
        expect({ gas: gas.actual, token: token.actual }).toEqual({ gas: gas.expected, token: token.expected })
      })
    })

    describe('MAYAChain (mayanode-mainnet-btc-eth-zec-trading-halted, height 19095919)', () => {
      const snapshot: MimirMaya = mayaMimir
      const lastHeight = mayaLastblock.find(({ mayachain }) => mayachain > 0)?.mayachain ?? 0
      const chains = Object.keys(DEFAULT_ENABLED_CHAINS)

      const actions = (chain: Chain, { mimir, haltedChains }: State): Actions => {
        const mimirHalt = getMayachainMimirHalt({ mimir, lastHeight, chains })
        const all = PoolHelpersMaya.disableAllActions({ chain, haltedChains, mimirHalt })
        const trading = PoolHelpersMaya.disableTradingActions({ chain, haltedChains, mimirHalt })
        // Withdraw.tsx calls the THOR helpers for MAYA pools too
        const thorMimirHalt = mimirHalt as unknown as MimirHalt
        return {
          add: all || trading || PoolHelpersMaya.disablePoolActions({ chain, haltedChains, mimirHalt }),
          withdraw:
            disableAllActions({ chain, haltedChains, mimirHalt: thorMimirHalt }) ||
            disableWithdrawActions({ chain, haltedChains, mimirHalt: thorMimirHalt }),
          swap: all || trading
        }
      }

      it.each([
        ['BTC', TRADING],
        ['ETH', TRADING],
        ['ZEC', TRADING],
        ['ARB', OPEN],
        ['DASH', OPEN],
        ['THOR', OPEN],
        ['ADA', OPEN]
      ])('snapshot: %s pools', (chain, expected) => {
        const { expected: e, actual } = agreed(expected, actions(chain, { mimir: snapshot, haltedChains: [] }))
        expect(actual).toEqual(e)
      })

      // ARB has no halt or pause in the snapshot; gas pool ARB.ETH, token pool ARB.USDC.
      // MAYA helpers are per chain (no PAUSELPDEPOSIT on MAYANode), so both pools share one expectation.
      const EXPECT: Record<string, Cells> = {
        // poolHelperMaya.ts table row PAUSELP{chain}: ADD NO, WITHDRAW NO, SWAP YES (global PAUSELP same)
        PAUSELP: { add: true, withdraw: true, swap: false },
        PAUSELPARB: { add: true, withdraw: true, swap: false },
        HALTARBCHAIN: ALL,
        [INBOUND]: ALL,
        HALTARBTRADING: TRADING,
        HALTTRADING: TRADING,
        HALTMAYACHAIN: { add: true, withdraw: 'D4', swap: true }
      }
      const codes = Object.keys(EXPECT)
      const base: State = { mimir: snapshot, haltedChains: [] }
      const tokenPool = assetFromStringEx('ARB.USDC-0xaf88d065e77c8cC2239327C5EDb3A432268e5831')

      it('matrix codes are all off in the snapshot', () => {
        expect(codes.filter((c) => c !== INBOUND).map((c) => [c, snapshot[c] ?? 0])).toEqual(
          codes.filter((c) => c !== INBOUND).map((c) => [c, 0])
        )
      })

      it.each(matrixRows(codes, []))('ARB: %s', (_, on) => {
        const state = codes.reduce((s, code) => toggle(ARBChain)(s, code, on.includes(code)), base)
        const expected = combine(on.map((code) => EXPECT[code]))
        const gas = agreed(expected, actions(AssetAETH.chain, state))
        const token = agreed(expected, actions(tokenPool.chain, state))
        expect({ gas: gas.actual, token: token.actual }).toEqual({ gas: gas.expected, token: token.expected })
      })
    })
  })
})
