import { ASGARDEX_NAME } from '../../../shared/const'

import { stampOneClickQuoteBody } from './referralStamp'

describe('stampOneClickQuoteBody', () => {
  it('adds referral to a quote body', () => {
    const stamped = JSON.parse(stampOneClickQuoteBody('{"dry":true,"amount":"1"}'))
    expect(stamped).toEqual({ dry: true, amount: '1', referral: ASGARDEX_NAME })
  })

  it('overwrites an existing referral', () => {
    const stamped = JSON.parse(stampOneClickQuoteBody('{"referral":"other"}'))
    expect(stamped.referral).toBe(ASGARDEX_NAME)
    expect(ASGARDEX_NAME).toBe('asgardex')
  })

  it('leaves invalid JSON unchanged', () => {
    expect(stampOneClickQuoteBody('not-json')).toBe('not-json')
  })

  it('leaves a JSON array unchanged', () => {
    expect(stampOneClickQuoteBody('[]')).toBe('[]')
  })
})
