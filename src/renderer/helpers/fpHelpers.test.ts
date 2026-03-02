import { function as FP, option as O } from 'fp-ts'

import { sequenceTOptionFromArray } from './fpHelpers'

describe('helpers/envHelper/', () => {
  describe('sequenceTOptionFromArray', () => {
    it('returns none for a list with none inside', () => {
      const result = FP.pipe([O.none, O.some(1)], sequenceTOptionFromArray)
      expect(result).toBeNone()
    })

    it('Lifts all "some" values', () => {
      const result = FP.pipe([O.some(1), O.some(2)], sequenceTOptionFromArray)
      expect(result).toEqual(O.some([1, 2]))
    })
  })
})
