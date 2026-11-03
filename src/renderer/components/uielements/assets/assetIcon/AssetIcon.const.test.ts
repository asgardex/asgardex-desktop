import { AssetSOLUSDC } from '../../../../const'
import { SOL_USDC_ICON_URL } from './AssetIcon.const'

describe('SOL.USDC icon', () => {
  it('pins the trustwallet logo URL for the SOL.USDC mint', () => {
    expect(SOL_USDC_ICON_URL).toBe(
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
    )
  })

  it('uses the same mint as AssetSOLUSDC', () => {
    expect(AssetSOLUSDC.symbol.toUpperCase()).toContain('EPJFWDD5AUFQSSQEM2QN1XZYBAPC8G4WEGGKZWYTDT1V')
    expect(SOL_USDC_ICON_URL).toContain('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  })

  it('does not use the dead swapkit token-list URL', () => {
    expect(SOL_USDC_ICON_URL).not.toContain('token-list-swapkit')
  })
})
