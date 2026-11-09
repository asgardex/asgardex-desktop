import { AssetType } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import { AssetXMR } from '../../../../shared/utils/chainIds'
import { getDecimalSync } from '../decimal'

describe('XMR decimals', () => {
  it('native XMR has 12 decimals (piconero)', () => {
    expect(getDecimalSync(AssetXMR)).toBe(12)
    expect(getDecimalSync({ chain: 'XMR', symbol: 'XMR', ticker: 'XMR', type: AssetType.NATIVE })).toBe(12)
  })
})
