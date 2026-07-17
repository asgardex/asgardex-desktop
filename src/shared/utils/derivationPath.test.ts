import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { THORChain } from '@xchainjs/xchain-thorchain'

import { getKeystoreDerivation } from './derivationPath'

describe('shared/utils/derivationPath — getKeystoreDerivation', () => {
  it('THOR default account/index → standard prefix + index 0', () => {
    const { rootDerivationPaths, walletIndex } = getKeystoreDerivation(THORChain, {
      hdMode: 'default',
      account: 0,
      index: 0
    })
    expect(rootDerivationPaths[Network.Mainnet]).toBe("m/44'/931'/0'/0/")
    expect(walletIndex).toBe(0)
  })

  it('THOR account 2 / index 5 → account in prefix, index returned', () => {
    const { rootDerivationPaths, walletIndex } = getKeystoreDerivation(THORChain, {
      hdMode: 'default',
      account: 2,
      index: 5
    })
    expect(rootDerivationPaths[Network.Mainnet]).toBe("m/44'/931'/2'/0/")
    expect(walletIndex).toBe(5)
  })

  it('ETH metamask mode → shared-account prefix', () => {
    const { rootDerivationPaths } = getKeystoreDerivation(ETHChain, { hdMode: 'metamask', account: 3, index: 1 })
    // metamask uses a fixed account segment (m/44'/60'/0'/0/)
    expect(rootDerivationPaths[Network.Mainnet]).toBe("m/44'/60'/0'/0/")
  })

  it('ETH ledgerlive mode → account varies in the path', () => {
    const { rootDerivationPaths } = getKeystoreDerivation(ETHChain, { hdMode: 'ledgerlive', account: 3, index: 1 })
    expect(rootDerivationPaths[Network.Mainnet]).toBe("m/44'/60'/3'/0/")
  })

  it('BTC testnet honors coin-type 1', () => {
    const { rootDerivationPaths } = getKeystoreDerivation(BTCChain, { hdMode: 'p2wpkh', account: 0, index: 0 })
    expect(rootDerivationPaths[Network.Testnet]).toBe("m/84'/1'/0'/0/")
    expect(rootDerivationPaths[Network.Mainnet]).toBe("m/84'/0'/0'/0/")
  })

  it('customPath wins: prefix + trailing index extracted', () => {
    const { rootDerivationPaths, walletIndex } = getKeystoreDerivation(ETHChain, {
      hdMode: 'default',
      account: 0,
      index: 0,
      customPath: "m/44'/60'/7'/0/9"
    })
    expect(rootDerivationPaths[Network.Mainnet]).toBe("m/44'/60'/7'/0/")
    expect(walletIndex).toBe(9)
  })
})
