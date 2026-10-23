import { ETHChain } from '@xchainjs/xchain-ethereum'
import { option as O } from 'fp-ts'
import { describe, expect, it } from 'vitest'

import { THORChain } from '../../../shared/utils/chainIds'
import type { PoolAddress } from './midgardTypes'
import { poolInboundMismatch } from './poolInbound'

const inbound = (address: string, router: O.Option<string>, halted = false): PoolAddress => ({
  protocol: THORChain,
  chain: ETHChain,
  address,
  router,
  halted
})

describe('poolInboundMismatch', () => {
  it('accepts a matching vault and router, including checksum and a stale halt flag', () => {
    const submitted = inbound('0xAbC', O.some('0xDeF'), true)
    const current = inbound('0xabc', O.some('0xdef'))
    expect(poolInboundMismatch(submitted, O.some(current), ETHChain)).toBeNull()
  })

  it('names the vault when only the vault differs', () => {
    expect(
      poolInboundMismatch(inbound('0xold', O.some('0xrouter')), O.some(inbound('0xnew', O.some('0xrouter'))), ETHChain)
    ).toBe('Vault address 0xold does not match the current ETH vault address (0xnew). Refresh and try again.')
  })

  it('names the router when only the router differs', () => {
    expect(
      poolInboundMismatch(inbound('0xvault', O.some('0xold')), O.some(inbound('0xvault', O.some('0xnew'))), ETHChain)
    ).toBe('Router address 0xold does not match the current ETH router address (0xnew). Refresh and try again.')
  })

  it('names the vault and the router when both differ', () => {
    expect(
      poolInboundMismatch(
        inbound('0xold', O.some('0xoldRouter')),
        O.some(inbound('0xnew', O.some('0xnewRouter'))),
        ETHChain
      )
    ).toBe(
      'Vault address 0xold does not match the current ETH vault address (0xnew). Router address 0xoldRouter does not match the current ETH router address (0xnewRouter). Refresh and try again.'
    )
  })

  it('treats a blank router as none', () => {
    expect(poolInboundMismatch(inbound('bc1q', O.some('  ')), O.some(inbound('bc1q', O.none)), ETHChain)).toBeNull()
  })

  it('names a missing router against a published router', () => {
    expect(
      poolInboundMismatch(inbound('0xvault', O.none), O.some(inbound('0xvault', O.some('0xrouter'))), ETHChain)
    ).toBe('Router address none does not match the current ETH router address (0xrouter). Refresh and try again.')
  })

  it('says there is no inbound when the chain row is missing', () => {
    expect(poolInboundMismatch(inbound('0xvault', O.none), O.none, ETHChain)).toBe(
      'No current ETH inbound address. Refresh and try again.'
    )
  })
})
