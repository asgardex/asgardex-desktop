import { Network } from '@xchainjs/xchain-client'
import { AssetType } from '@xchainjs/xchain-util'

import { AssetXRD, Client, RadixChain, generateAddressParam } from './radixAmmStub'

describe('radixAmmStub', () => {
  it('matches the chain id Maya AMM compares against', () => {
    expect(RadixChain).toBe('XRD')
    expect(AssetXRD).toEqual({
      chain: 'XRD',
      symbol: 'XRD',
      ticker: 'XRD',
      type: AssetType.NATIVE
    })
  })

  it('can be constructed on mainnet without the Radix toolkit', () => {
    const client = new Client({ network: Network.Mainnet })

    expect(client.getNetwork()).toBe(Network.Mainnet)
    expect(client.validateAddress('account_rdx1example')).toBe(true)
    expect(client.validateAddress('thor1example')).toBe(false)
  })

  it('refuses a Maya deposit into Radix', () => {
    expect(generateAddressParam).toThrow(/delisted/)
  })
})
