import { ADAAsset, AssetBTC, AssetETH } from '../../../shared/utils/asset'
import { reduceIsSendMax } from '../../helpers/assetHelper'

describe('reduceIsSendMax', () => {
  it('clears the flag when the source asset changes', () => {
    expect(reduceIsSendMax(true, { type: 'changeSource' })).toBe(false)
  })

  it('clears a stuck flag when an amount is typed on ADA', () => {
    expect(reduceIsSendMax(true, { type: 'typeAmount', asset: ADAAsset })).toBe(false)
  })

  it('clears the flag at 50% on ADA', () => {
    expect(reduceIsSendMax(true, { type: 'percent', asset: ADAAsset, percents: 50 })).toBe(false)
  })

  it('sets the flag at 100% on ADA and BTC', () => {
    expect(reduceIsSendMax(false, { type: 'percent', asset: ADAAsset, percents: 100 })).toBe(true)
    expect(reduceIsSendMax(false, { type: 'percent', asset: AssetBTC, percents: 100 })).toBe(true)
  })

  it('leaves the flag unchanged for percent 100 and typing on ETH', () => {
    expect(reduceIsSendMax(true, { type: 'percent', asset: AssetETH, percents: 100 })).toBe(true)
    expect(reduceIsSendMax(true, { type: 'typeAmount', asset: AssetETH })).toBe(true)
  })

  it('is false after BTC Max, a source change, then typing on ADA', () => {
    const afterMax = reduceIsSendMax(false, { type: 'percent', asset: AssetBTC, percents: 100 })
    const afterChange = reduceIsSendMax(afterMax, { type: 'changeSource' })
    expect(reduceIsSendMax(afterChange, { type: 'typeAmount', asset: ADAAsset })).toBe(false)
  })

  it('is false after BTC Max then a source change', () => {
    const afterMax = reduceIsSendMax(false, { type: 'percent', asset: AssetBTC, percents: 100 })
    expect(reduceIsSendMax(afterMax, { type: 'changeSource' })).toBe(false)
  })
})
