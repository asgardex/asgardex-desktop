import { option as O } from 'fp-ts'

import { parseSwapMemoDestination, swapDestinationMatches } from './memoHelper'

describe('helpers/memoHelper', () => {
  describe('parseSwapMemoDestination', () => {
    it('extracts the destination from a THORChain swap memo (= alias)', () => {
      const memo = '=:ETH.ETH:0xRecipient:1000/3/0:dx:10'
      expect(parseSwapMemoDestination(memo)).toEqual(O.some('0xRecipient'))
    })

    it('extracts the destination from a SWAP-prefixed memo', () => {
      const memo = 'SWAP:BTC.BTC:bc1qrecipient:0/1/1'
      expect(parseSwapMemoDestination(memo)).toEqual(O.some('bc1qrecipient'))
    })

    it('returns None for a non-swap memo (e.g. deposit/add)', () => {
      expect(parseSwapMemoDestination('+:BTC.BTC:thoraddr')).toBeNone()
      expect(parseSwapMemoDestination('LEAVE:thoraddr')).toBeNone()
    })

    it('returns None when there is no destination or the memo is empty', () => {
      expect(parseSwapMemoDestination('=:ETH.ETH')).toBeNone()
      expect(parseSwapMemoDestination('=:ETH.ETH:')).toBeNone()
      expect(parseSwapMemoDestination('')).toBeNone()
    })
  })

  describe('swapDestinationMatches', () => {
    it('matches identical addresses', () => {
      expect(swapDestinationMatches('thor1abc', 'thor1abc')).toBe(true)
    })

    it('matches ignoring case (EVM checksum) and surrounding whitespace', () => {
      expect(swapDestinationMatches('0xAbCdEf', ' 0xabcdef ')).toBe(true)
    })

    it('does not match different addresses', () => {
      expect(swapDestinationMatches('0xrecipient', '0xattacker')).toBe(false)
    })
  })
})
