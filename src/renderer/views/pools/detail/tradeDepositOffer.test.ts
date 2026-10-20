import * as RD from '@devexperts/remote-data-ts'
import { baseAmount } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import type { TradeAccount } from '../../../services/thorchain/types'
import { offerTradeDepositFor } from './tradeDepositOffer'

const accounts = (units: number): TradeAccount[] => [{ units: baseAmount(units, 8) } as TradeAccount]

describe('offerTradeDepositFor', () => {
  it('offers deposit when this chart account is empty and the other dex is empty', () => {
    expect(offerTradeDepositFor(RD.success(accounts(0)), RD.success(accounts(0)))).toBe(true)
  })

  it('hides deposit when this chart account holds funds', () => {
    expect(offerTradeDepositFor(RD.success(accounts(1)), RD.pending)).toBe(false)
  })

  it('hides deposit when the other dex is known to hold funds', () => {
    expect(offerTradeDepositFor(RD.success(accounts(0)), RD.success(accounts(5)))).toBe(false)
  })

  it('does not wait on a pending, failed, or missing probe for the other dex', () => {
    const empty = RD.success(accounts(0))
    expect(offerTradeDepositFor(empty, RD.pending)).toBe(true)
    expect(offerTradeDepositFor(empty, RD.failure(new Error('down')))).toBe(true)
    expect(offerTradeDepositFor(empty, RD.initial)).toBe(true)
  })

  it('waits until this chart account has loaded', () => {
    expect(offerTradeDepositFor(RD.pending, RD.success(accounts(0)))).toBe(false)
    expect(offerTradeDepositFor(RD.initial, RD.initial)).toBe(false)
    expect(offerTradeDepositFor(RD.failure(new Error('down')), RD.initial)).toBe(false)
  })
})
