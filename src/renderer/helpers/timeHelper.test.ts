import * as O from 'fp-ts/Option'

import { roundUnixTimestampToMinutes } from './timeHelper' // Adjust path as needed

describe('roundUnixTimestampToMinutes', () => {
  it('should return None for undefined timestamp', () => {
    const result = roundUnixTimestampToMinutes()(undefined)
    expect(O.isNone(result)).toBe(true)
  })

  it('should round down to the nearest 5 minutes by default', () => {
    const timeStamp = 1633044620 // Example timestamp (01:17:00 UTC)
    const expected = 1633044600 // Rounded down to 01:16:00 UTC
    const result = roundUnixTimestampToMinutes()(timeStamp)
    expect(O.isSome(result)).toBe(true)
    expect(O.toNullable(result)).toBe(expected)
  })

  it('should round down to the nearest 10 minutes if roundBasis is 10', () => {
    const timeStamp = 1633044620 // 01:17:00 UTC
    const expected = 1633044600 // Should round down to 01:10:00 UTC
    const result = roundUnixTimestampToMinutes(10)(timeStamp)
    expect(O.isSome(result)).toBe(true)
    expect(O.toNullable(result)).toBe(expected)
  })

  it('should return the same timestamp if already rounded', () => {
    const timeStamp = 1633044600 // Already at 5-minute interval
    const result = roundUnixTimestampToMinutes()(timeStamp)
    expect(O.isSome(result)).toBe(true)
    expect(O.toNullable(result)).toBe(timeStamp)
  })
})
