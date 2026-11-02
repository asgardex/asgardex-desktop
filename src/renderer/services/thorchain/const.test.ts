import { describe, expect, it } from 'vitest'

import { DEFAULT_MIMIR_HALT, getPoolDepositPauseMimirKey } from './const'

describe('services/thorchain/const', () => {
  describe('getPoolDepositPauseMimirKey', () => {
    // THORNode: `PauseLPDeposit-<asset.MimirString()>` = CHAIN-SYMBOL of the gas asset
    it.each([
      ['BTC', 'PAUSELPDEPOSIT-BTC-BTC'],
      ['ETH', 'PAUSELPDEPOSIT-ETH-ETH'],
      ['AVAX', 'PAUSELPDEPOSIT-AVAX-AVAX'],
      ['BSC', 'PAUSELPDEPOSIT-BSC-BNB'],
      ['GAIA', 'PAUSELPDEPOSIT-GAIA-ATOM'],
      ['BASE', 'PAUSELPDEPOSIT-BASE-ETH'],
      ['TRON', 'PAUSELPDEPOSIT-TRON-TRX']
    ])('%s -> %s', (chain, key) => {
      expect(getPoolDepositPauseMimirKey(chain)).toBe(key)
    })
  })

  describe('DEFAULT_MIMIR_HALT', () => {
    it('holds the gas-pool deposit keys by asset symbol', () => {
      expect(DEFAULT_MIMIR_HALT['PAUSELPDEPOSIT-BSC-BNB']).toBe(false)
      expect(DEFAULT_MIMIR_HALT['PAUSELPDEPOSIT-GAIA-ATOM']).toBe(false)
      expect(Object.keys(DEFAULT_MIMIR_HALT)).not.toContain('PAUSELPDEPOSIT-BSC-BSC')
      expect(Object.keys(DEFAULT_MIMIR_HALT)).not.toContain('PAUSELPDEPOSIT-GAIA-GAIA')
    })
  })
})
