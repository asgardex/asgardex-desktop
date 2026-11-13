import { AssetETH } from '@xchainjs/xchain-ethereum'
import { AssetType, baseAmount } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { describe, expect, it } from 'vitest'

import { AssetBTC } from '../../../../shared/utils/asset'
import { tradeDepositSpendable } from './spendable'

const ethUsdt = {
  chain: AssetETH.chain,
  symbol: 'USDT-0xdAC17F958D2ee523a2206206994597C13D831ec7',
  ticker: 'USDT',
  type: AssetType.TOKEN
}

describe('tradeDepositSpendable', () => {
  it('keeps the network fee out of a BTC trade deposit', () => {
    const spendable = tradeDepositSpendable(AssetBTC, baseAmount(1_000_000, 8), O.some(baseAmount(5_460, 8)))
    expect(O.isSome(spendable) && spendable.value.amount().toNumber()).toBe(994_540)
  })

  it('has no BTC maximum until the fee is known', () => {
    expect(O.isNone(tradeDepositSpendable(AssetBTC, baseAmount(1_000_000, 8), O.none))).toBe(true)
  })

  it('returns zero when the fee is the whole balance', () => {
    const spendable = tradeDepositSpendable(AssetBTC, baseAmount(1_000, 8), O.some(baseAmount(5_000, 8)))
    expect(O.isSome(spendable) && spendable.value.amount().toNumber()).toBe(0)
  })

  it('does not subtract a gas fee from a token balance', () => {
    const spendable = tradeDepositSpendable(ethUsdt, baseAmount(50_000_000, 6), O.none)
    expect(O.isSome(spendable) && spendable.value.amount().toNumber()).toBe(50_000_000)
  })
})
