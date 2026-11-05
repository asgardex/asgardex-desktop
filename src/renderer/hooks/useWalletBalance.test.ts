import { filterChainBalancesForTotals } from './useWalletBalance'

const cb = (chain: string) => ({ chain, balances: [] })

describe('hooks/useWalletBalance filterChainBalancesForTotals', () => {
  it('keeps enabled chains', () => {
    expect(filterChainBalancesForTotals([cb('BTC'), cb('ETH')], ['BTC', 'ETH']).map((c) => c.chain)).toEqual([
      'BTC',
      'ETH'
    ])
  })

  it('drops chains which are not enabled', () => {
    expect(filterChainBalancesForTotals([cb('BTC'), cb('ETH')], ['BTC']).map((c) => c.chain)).toEqual(['BTC'])
  })

  it('never includes XMR in totals, even when XMR is enabled ("received, spends not tracked" is not a balance)', () => {
    const result = filterChainBalancesForTotals([cb('BTC'), cb('XMR')], ['BTC', 'XMR'])
    expect(result.map((c) => c.chain)).toEqual(['BTC'])
  })
})
