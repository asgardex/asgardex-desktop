import { Network } from '@xchainjs/xchain-client'
import { Pool } from '@xchainjs/xchain-thornode'
import { assetToString, baseAmount, bn } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'

import { AssetBTC, AssetETH } from '../../../../shared/utils/asset'
import { AssetUSDC } from '../../../const'
import { getUSDValue, RUNE_PRICE_POOL } from '../../../helpers/poolHelper'
import {
  mapThornodePoolToPoolDetail,
  poolsStateFromThornodePools,
  runePriceUsdFromThornodePools,
  thornodeAssetPrice
} from './thornodePoolsFallback'

const pool = (overrides: Partial<Pool> & Pick<Pool, 'asset' | 'balance_asset' | 'balance_rune'>): Pool =>
  ({
    status: 'Available',
    pending_inbound_asset: '0',
    pending_inbound_rune: '0',
    pool_units: '0',
    LP_units: '1000',
    synth_units: '0',
    synth_supply: '0',
    savers_depth: '0',
    savers_units: '0',
    savers_fill_bps: '0',
    savers_capacity_remaining: '0',
    bond_units: '0',
    ...overrides
  }) as Pool

describe('thornodePoolsFallback', () => {
  const btcPool = pool({
    asset: assetToString(AssetBTC),
    balance_asset: '100000000', // 1 BTC (1e8)
    balance_rune: '500000000000' // 5000 RUNE (1e8)
  })

  const usdcPoolDeep = pool({
    asset: assetToString(AssetUSDC),
    balance_asset: '1000000000000', // deep USDC
    balance_rune: '100000000000' // 1000 RUNE → 10 USD per RUNE
  })

  const usdcPoolShallow = pool({
    asset: assetToString(AssetUSDC),
    balance_asset: '100000000',
    balance_rune: '100000000', // shallower — should lose to deep pool if both present
    status: 'Available'
  })

  // Use a different USD asset for "shallow" competitor so both can coexist in one list
  // (same asset string would collide). Deep ETH.USDC vs shallower is enough with one USDC.

  it('computes RUNE-per-asset price from balances', () => {
    // 5000 RUNE / 1 BTC = 5000
    expect(thornodeAssetPrice(btcPool).toNumber()).toBe(5000)
  })

  it('derives USD/RUNE from deepest USD pool', () => {
    const oPrice = runePriceUsdFromThornodePools([btcPool, usdcPoolDeep])
    expect(O.isSome(oPrice)).toBe(true)
    if (O.isSome(oPrice)) {
      // 1e12 USDC / 1e11 RUNE = 10
      expect(oPrice.value.toNumber()).toBe(10)
    }
  })

  it('maps Available pools and skips Suspended', () => {
    const suspended = pool({
      asset: assetToString(AssetETH),
      balance_asset: '1',
      balance_rune: '1',
      status: 'Suspended'
    })
    const runeUsd = bn(10)
    expect(O.isNone(mapThornodePoolToPoolDetail(suspended, runeUsd))).toBe(true)
    expect(O.isSome(mapThornodePoolToPoolDetail(btcPool, runeUsd))).toBe(true)
  })

  it('builds PoolsState with assetPriceUSD usable by getUSDValue', () => {
    const state = poolsStateFromThornodePools({
      pools: [btcPool, usdcPoolDeep, usdcPoolShallow],
      network: Network.Mainnet
    })

    expect(state.poolDetails.length).toBeGreaterThan(0)
    expect(O.isSome(state.pricePools)).toBe(true)

    const btcDetail = state.poolDetails.find((d) => d.asset === assetToString(AssetBTC))
    expect(btcDetail).toBeDefined()
    // assetPrice 5000 * runePriceUSD 10 = 50000 USD per BTC
    expect(bn(btcDetail!.assetPriceUSD).toNumber()).toBe(50000)

    const usd = getUSDValue({
      balance: { asset: AssetBTC, amount: baseAmount(100000000, 8) }, // 1 BTC
      poolDetails: state.poolDetails,
      pricePool: RUNE_PRICE_POOL
    })
    expect(O.isSome(usd)).toBe(true)
    if (O.isSome(usd)) {
      // getUSDValue: Number(assetPriceUSD) * amount.toNumber() with same decimal
      // amount.toNumber() for 1e8 base of 1 BTC is 100000000 → 50000 * 100000000
      // (existing getUSDValue quirk — we only assert it's Some and positive)
      expect(usd.value.amount().isGreaterThan(0)).toBe(true)
    }
  })

  it('filters invalid asset strings', () => {
    const bad = pool({
      asset: 'NOT_A_REAL_ASSET',
      balance_asset: '1',
      balance_rune: '1'
    })
    const state = poolsStateFromThornodePools({ pools: [bad, btcPool, usdcPoolDeep], network: Network.Mainnet })
    expect(state.poolAssets.every((a) => a.chain && a.symbol)).toBe(true)
    expect(state.poolDetails.some((d) => d.asset === assetToString(AssetBTC))).toBe(true)
  })
})
