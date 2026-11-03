import { describe, expect, it } from 'vitest'

import { resolveLiquifyKeys } from './liquifyKeys'

// Fake values only — never real keys.
describe('main/api/liquifyKeys', () => {
  it('maps the three VITE_LIQUIFY_* names to the Midgard / THORNode API / THORNode RPC keys', () => {
    expect(
      resolveLiquifyKeys({
        VITE_LIQUIFY_MIDGARD_API_KEY: 'm',
        VITE_LIQUIFY_THORCHAIN_API_KEY: 'a',
        VITE_LIQUIFY_THORCHAIN_RPC_KEY: 'r'
      })
    ).toEqual({ midgard: 'm', thornodeApi: 'a', thornodeRpc: 'r' })
  })

  it('keys are independent', () => {
    expect(resolveLiquifyKeys({ VITE_LIQUIFY_THORCHAIN_API_KEY: 'a' })).toEqual({
      midgard: '',
      thornodeApi: 'a',
      thornodeRpc: ''
    })
  })

  it('trims values and returns all-empty keys when nothing is set', () => {
    expect(resolveLiquifyKeys({ VITE_LIQUIFY_MIDGARD_API_KEY: '  m  ' }).midgard).toBe('m')
    expect(resolveLiquifyKeys({})).toEqual({ midgard: '', thornodeApi: '', thornodeRpc: '' })
    expect(resolveLiquifyKeys({ VITE_LIQUIFY_MIDGARD_API_KEY: '', VITE_LIQUIFY_THORCHAIN_API_KEY: '   ' })).toEqual({
      midgard: '',
      thornodeApi: '',
      thornodeRpc: ''
    })
  })

  it('ignores unsafe values (header injection)', () => {
    expect(resolveLiquifyKeys({ VITE_LIQUIFY_THORCHAIN_RPC_KEY: 'bad key\r\nX-Evil: 1' }).thornodeRpc).toBe('')
  })
})
