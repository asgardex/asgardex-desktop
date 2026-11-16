import { toBech32 } from '@cosmjs/encoding'
import { option as O } from 'fp-ts'

import { RUNEBOND_LISTING_ADDRESS, thorMainnetAddress } from './runebond'

describe('thorMainnetAddress', () => {
  it('accepts a mainnet account address and stores it in lowercase', () => {
    expect(thorMainnetAddress(`  ${RUNEBOND_LISTING_ADDRESS.toUpperCase()}  `)).toEqual(
      O.some(RUNEBOND_LISTING_ADDRESS)
    )
  })

  it('rejects a broken checksum, mixed case, the wrong prefix, and the wrong length', () => {
    const broken = `${RUNEBOND_LISTING_ADDRESS.slice(0, -1)}q`
    const mixed = `${RUNEBOND_LISTING_ADDRESS.slice(0, 10)}${RUNEBOND_LISTING_ADDRESS[10].toUpperCase()}${RUNEBOND_LISTING_ADDRESS.slice(11)}`
    const account = new Uint8Array(20).fill(1)

    expect(thorMainnetAddress(broken)).toEqual(O.none)
    expect(thorMainnetAddress(mixed)).toEqual(O.none)
    expect(thorMainnetAddress('thor1')).toEqual(O.none)
    expect(thorMainnetAddress('')).toEqual(O.none)
    expect(thorMainnetAddress('not an address')).toEqual(O.none)
    expect(thorMainnetAddress(toBech32('tthor', account))).toEqual(O.none)
    expect(thorMainnetAddress(toBech32('thor', new Uint8Array(32).fill(2)))).toEqual(O.none)
  })
})
