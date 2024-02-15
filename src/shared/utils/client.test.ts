import { Network } from '@xchainjs/xchain-client'

import { toClientNetwork } from './client'

describe('shared/utils/client', () => {
  describe('getClientNetwork', () => {
    it('for testnet', () => {
      expect(toClientNetwork(Network.Testnet)).toEqual(Network.Testnet)
    })
    it('for stagenet', () => {
      expect(toClientNetwork(Network.Stagenet)).toEqual(Network.Stagenet)
    })
    it('for mainnent', () => {
      expect(toClientNetwork(Network.Mainnet)).toEqual(Network.Mainnet)
    })
  })
})
