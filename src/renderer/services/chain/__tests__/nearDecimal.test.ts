import { describe, expect, it } from 'vitest'

import { NEARChain } from '@xchainjs/xchain-near'
import { AssetType } from '@xchainjs/xchain-util'

import { getDecimalSync } from '../decimal'
import { getTokenDecimal } from '../tokenDecimalMap'

describe('NEAR token decimals', () => {
  it('maps Circle USDC to 6', () => {
    expect(getTokenDecimal('NEAR', 'USDC-17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1')).toBe(6)
  })

  it('getDecimalSync USDC is 6 not 24', () => {
    const usdc = {
      chain: NEARChain,
      symbol: 'USDC-17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
      ticker: 'USDC',
      type: AssetType.TOKEN
    }
    expect(getDecimalSync(usdc)).toBe(6)
  })

  it('native NEAR stays 24', () => {
    const near = { chain: NEARChain, symbol: 'NEAR', ticker: 'NEAR', type: AssetType.NATIVE }
    expect(getDecimalSync(near)).toBe(24)
  })
})
