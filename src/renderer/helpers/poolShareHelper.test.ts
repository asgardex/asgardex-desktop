import { assetAmount, assetToBase, bn } from '@xchainjs/xchain-util'

import { ZERO_BN } from '../const'
import { THORCHAIN_DECIMAL } from './assetHelper'
import { eqBaseAmount } from './fp/eq'
import { getAssetShare, getPoolShare, getRuneShare } from './poolShareHelper'

describe('poolShareHelpers', () => {
  it('calculates the correct rune share', () => {
    const liquidityUnits = bn('300000000')
    const pool = { runeDepth: '12', units: '2' }

    const result = getRuneShare(liquidityUnits, pool, THORCHAIN_DECIMAL)
    const expected = assetToBase(assetAmount(18, 8))

    expect(eqBaseAmount.equals(result, expected)).toBeTruthy()
  })

  it('getAssetShare', () => {
    const result = getAssetShare({
      liquidityUnits: bn('300000000'),
      detail: { assetDepth: '12', units: '2' },
      assetDecimal: 8
    })
    const expected = assetToBase(assetAmount(18))
    expect(eqBaseAmount.equals(result, expected)).toBeTruthy()
  })

  // MAYA pools store `assetDepth` in the Midgard depth scale (1e8 for most assets, 1e4 for
  // MAYA.MAYA) — NOT the asset's native decimal. `getMayaPoolDepthDecimal` supplies `dexDecimal`;
  // the share is then converted to the asset's native decimal. See docs/MAYA_POOL_DEPTH_DECIMAL_FIX.md.
  it('getAssetShare: MAYA ADA pool (dexDecimal=8, assetDecimal=6)', () => {
    const result = getAssetShare({
      liquidityUnits: bn('1'),
      detail: { assetDepth: '1000000000', units: '2' }, // 10 ADA depth in 1e8 scale
      assetDecimal: 6,
      dexDecimal: 8
    })
    // share = 1 * 1e9 / 2 = 5e8 (1e8 scale) → 5 ADA in 1e6 scale
    const expected = assetToBase(assetAmount(5, 6))
    expect(eqBaseAmount.equals(result, expected)).toBeTruthy()
  })

  it('getAssetShare: MAYA.MAYA pool (dexDecimal=4, assetDecimal=4)', () => {
    const result = getAssetShare({
      liquidityUnits: bn('1'),
      detail: { assetDepth: '100000', units: '2' }, // 10 MAYA depth in 1e4 scale
      assetDecimal: 4,
      dexDecimal: 4
    })
    // share = 1 * 1e5 / 2 = 5e4 (1e4 scale) → 5 MAYA, no rescale (4 === 4)
    const expected = assetToBase(assetAmount(5, 4))
    expect(eqBaseAmount.equals(result, expected)).toBeTruthy()
  })

  it('getPoolShare', () => {
    expect(getPoolShare(ZERO_BN, { units: '6' })).toEqual(ZERO_BN)

    expect(getPoolShare(bn('300000000'), { units: '6' })).toEqual(bn('5000000000'))
  })
})
