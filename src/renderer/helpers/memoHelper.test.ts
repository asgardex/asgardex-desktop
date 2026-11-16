import { baseAmount } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'

import { getRunebondWhitelistRequestMemo, parseSwapMemoDestination, swapDestinationMatches } from './memoHelper'

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

    it('matches EVM addresses ignoring checksum case and surrounding whitespace', () => {
      const checksummed = '0xF155e9cDd77a5d77073ab43d17F661507c08e23D'
      const lower = ` ${checksummed.toLowerCase()} `
      expect(swapDestinationMatches(checksummed, lower)).toBe(true)
    })

    it('compares non-EVM (Base58) addresses case-sensitively', () => {
      // Differ only in case — must NOT be treated as equal for case-sensitive formats
      expect(swapDestinationMatches('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', '1bvbmseystwetqtfn5au4m4gfg7xjanvn2')).toBe(
        false
      )
    })

    it('does not match different addresses', () => {
      expect(
        swapDestinationMatches(
          '0xF155e9cDd77a5d77073ab43d17F661507c08e23D',
          '0x0000000000000000000000000000000000000000'
        )
      ).toBe(false)
    })
  })

  describe('getRunebondWhitelistRequestMemo', () => {
    it('builds a TB:WHT memo, and leaves the affiliate off when there is none', () => {
      const node = 'thor1nodeaddress'
      const provider = 'thor1provideraddress'
      const intendedBond = baseAmount(250_000_000, 8)

      expect(getRunebondWhitelistRequestMemo(node, provider, intendedBond, 'thor1affiliate')).toBe(
        'TB:WHT:thor1nodeaddress:thor1provideraddress:250000000:thor1affiliate'
      )
      expect(getRunebondWhitelistRequestMemo(node, provider, intendedBond)).toBe(
        'TB:WHT:thor1nodeaddress:thor1provideraddress:250000000'
      )
      expect(getRunebondWhitelistRequestMemo(node, provider, intendedBond, undefined)).toBe(
        'TB:WHT:thor1nodeaddress:thor1provideraddress:250000000'
      )
    })
  })
})
