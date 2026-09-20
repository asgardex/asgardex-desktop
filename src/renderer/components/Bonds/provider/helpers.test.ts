import { assetAmount, assetToBase, baseAmount } from '@xchainjs/xchain-util'

import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { NodeStatusEnum } from '../../../services/thorchain/types'
import {
  addressExplorerUrl,
  formatChurnDate,
  formatCountdown,
  formatDuration,
  formatOperatorFee,
  formatRuneAmount,
  isUnbondLocked,
  nodeExplorerUrl,
  shortenAddress
} from './helpers'

const rune = (amount: string | number) => assetToBase(assetAmount(amount, THORCHAIN_DECIMAL))

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('Bonds provider helpers', () => {
  describe('formatRuneAmount', () => {
    it('renders amounts >= 1000 as integers, like the designs', () => {
      expect(formatRuneAmount(rune(1013547.42))).toEqual('1,013,547')
      expect(formatRuneAmount(rune(1000))).toEqual('1,000')
    })

    it('keeps up to four decimals below 1000, so small payouts stay visible', () => {
      expect(formatRuneAmount(rune(0.0032))).toEqual('0.0032')
      expect(formatRuneAmount(rune(999.12345))).toEqual('999.1235')
    })

    it('falls back to eight decimals when four would round a payout down to zero', () => {
      expect(formatRuneAmount(rune(0.00001234))).toEqual('0.00001234')
    })

    it('renders an exact zero without decimals', () => {
      expect(formatRuneAmount(rune(0))).toEqual('0')
    })

    it('honours an explicit decimal count', () => {
      expect(formatRuneAmount(rune(1234.5678), 2)).toEqual('1,234.57')
    })
  })

  describe('formatDuration', () => {
    it('collapses to the two largest units', () => {
      expect(formatDuration(DAY + 14 * HOUR + 21 * MINUTE)).toEqual('1d 14h')
      expect(formatDuration(5 * HOUR + 12 * MINUTE)).toEqual('5h 12m')
      expect(formatDuration(12 * MINUTE)).toEqual('12m')
    })

    it('never renders a negative duration', () => {
      expect(formatDuration(-HOUR)).toEqual('0m')
    })
  })

  describe('formatCountdown', () => {
    it('keeps the minutes at every magnitude, so the timer is seen moving', () => {
      expect(formatCountdown(DAY + 14 * HOUR + 21 * MINUTE)).toEqual('1d 14h 21m')
      expect(formatCountdown(5 * HOUR + 12 * MINUTE)).toEqual('5h 12m')
      expect(formatCountdown(12 * MINUTE)).toEqual('12m')
    })
  })

  describe('formatChurnDate', () => {
    it('renders the churn date of a chart tooltip', () => {
      expect(formatChurnDate(new Date('2026-06-21T10:00:00Z'), 'en-US')).toEqual('Jun 21, 2026')
    })
  })

  describe('shortenAddress', () => {
    it('keeps the head and the tail of a THOR address', () => {
      expect(shortenAddress('thor1h4kjqabcdefghijklmnophyfpwkfr')).toEqual('thor1h4k…hyfpwkfr')
    })

    it('leaves short addresses untouched', () => {
      expect(shortenAddress('thor1short')).toEqual('thor1short')
    })
  })

  describe('formatOperatorFee', () => {
    it('renders the basis points THORNode reports as a percentage', () => {
      expect(formatOperatorFee(baseAmount(150, THORCHAIN_DECIMAL), 'en-US')).toEqual('1.5')
      expect(formatOperatorFee(baseAmount(0, THORCHAIN_DECIMAL), 'en-US')).toEqual('0')
      expect(formatOperatorFee(baseAmount(10000, THORCHAIN_DECIMAL), 'en-US')).toEqual('100')
    })
  })

  describe('isUnbondLocked', () => {
    it('locks an active node', () => {
      expect(isUnbondLocked(NodeStatusEnum.Active, [])).toBe(true)
    })

    it('locks a node that still belongs to a vault', () => {
      expect(isUnbondLocked(NodeStatusEnum.Standby, ['thorpub1addwnpepqvault'])).toBe(true)
    })

    it('unlocks a standby node that has churned out', () => {
      expect(isUnbondLocked(NodeStatusEnum.Standby, [])).toBe(false)
    })

    it('treats a missing membership as no membership, as THORNode sends null', () => {
      expect(isUnbondLocked(NodeStatusEnum.Standby, null as unknown as string[])).toBe(false)
    })
  })

  describe('explorer urls', () => {
    it('points at the node and address pages', () => {
      expect(nodeExplorerUrl('thor1node')).toEqual('https://thorchain.net/node/thor1node')
      expect(addressExplorerUrl('thor1addr')).toEqual('https://thorchain.net/address/thor1addr')
    })
  })
})
