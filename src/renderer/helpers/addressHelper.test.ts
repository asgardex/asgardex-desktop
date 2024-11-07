import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { THORChain } from '@xchainjs/xchain-thorchain'
import * as O from 'fp-ts/lib/Option'

import { WalletType } from '../../shared/wallet/types'
import { LedgerAddresses } from '../services/wallet/types'
import { getEVMChecksumAddress, hasLedgerAddress, removeAddressPrefix, truncateAddress } from './addressHelper'

describe('helpers/addressHelper', () => {
  describe('truncateAddress', () => {
    it('thorchain testnet', () => {
      const result = truncateAddress('tthor13gym97tmw3axj3hpewdggy2cr288d3qffr8skg', THORChain, Network.Testnet)
      expect(result).toEqual('tthor13g...skg')
    })

    it('thorchain mainnet', () => {
      const result = truncateAddress('thor13gym97tmw3axj3hpewdggy2cr288d3qffr8skg', THORChain, Network.Mainnet)
      expect(result).toEqual('thor13g...skg')
    })

    it('bitcoin testnet', () => {
      const result = truncateAddress('tb1qtephp596jhpwrawlp67junuk347zl2cwc56xml', BTCChain, Network.Testnet)
      expect(result).toEqual('tb1qte...xml')
    })

    it('bitcoin mainnet', () => {
      const result = truncateAddress('bc1qtephp596jhpwrawlp67junuk347zl2cwc56xml', BTCChain, Network.Testnet)
      expect(result).toEqual('bc1qte...xml')
    })

    it('bitcoin cash testnet', () => {
      const result = truncateAddress('mzvxEYsFXBhfsZj2QNwQXfFX6KCoweqZpM', BCHChain, Network.Testnet)
      expect(result).toEqual('mzvxEY...ZpM')
    })

    it('bitcoin cash mainnet', () => {
      const result = truncateAddress('13kwsEHsKn82UobM9WaTRbU2vCW5qXkY97', BCHChain, Network.Testnet)
      expect(result).toEqual('13kwsE...Y97')
    })

    it('litecoin testnet', () => {
      const result = truncateAddress('tltc1qtephp596jhpwrawlp67junuk347zl2cwpucctk', LTCChain, Network.Testnet)
      expect(result).toEqual('tltc1qte...ctk')
    })

    it('litecoin mainnet', () => {
      const result = truncateAddress('ltc1qtephp596jhpwrawlp67junuk347zl2cwpucctk', LTCChain, Network.Testnet)
      expect(result).toEqual('ltc1qtep...ctk')
    })

    it('cosmos mainnet', () => {
      const result = truncateAddress('cosmos1av54qcmavhjkqsd67cf6f4cedqjrdeh7ed86fc', GAIAChain, Network.Testnet)
      expect(result).toEqual('cosmos1av...6fc')
    })

    it('DOGE mainnet', () => {
      const result = truncateAddress('DT5SRCKHexHYzGanDkSPpaHW87KJ7yUBac', DOGEChain, Network.Testnet)
      expect(result).toEqual('DT5SRC...Bac')
    })
  })

  describe('removeAddressPrefix', () => {
    it('thorchain testnet', () => {
      const result = removeAddressPrefix('tthor13gym97tmw3axj3hpewdggy2cr288d3qffr8skg')
      expect(result).toEqual('tthor13gym97tmw3axj3hpewdggy2cr288d3qffr8skg')
    })

    it('thorchain mainnet', () => {
      const result = removeAddressPrefix('thor13gym97tmw3axj3hpewdggy2cr288d3qffr8skg')
      expect(result).toEqual('thor13gym97tmw3axj3hpewdggy2cr288d3qffr8skg')
    })

    it('bitcoin testnet', () => {
      const result = removeAddressPrefix('tb1qtephp596jhpwrawlp67junuk347zl2cwc56xml')
      expect(result).toEqual('tb1qtephp596jhpwrawlp67junuk347zl2cwc56xml')
    })

    it('bitcoin mainnet', () => {
      const result = removeAddressPrefix('bc1qtephp596jhpwrawlp67junuk347zl2cwc56xml')
      expect(result).toEqual('bc1qtephp596jhpwrawlp67junuk347zl2cwc56xml')
    })

    it('bitcoin cash testnet', () => {
      const result = removeAddressPrefix('bchtest:qr20g55jd7x3dalp4qxjfgfvda0nwr8cfccrgxd0dw')
      expect(result).toEqual('qr20g55jd7x3dalp4qxjfgfvda0nwr8cfccrgxd0dw')
    })

    it('bitcoin cash mainnet', () => {
      const result = removeAddressPrefix('bitcoincash:qr20g55jd7x3dalp4qxjfgfvda0nwr8cfccrgxd0dw')
      expect(result).toEqual('qr20g55jd7x3dalp4qxjfgfvda0nwr8cfccrgxd0dw')
    })

    it('litecoin testnet', () => {
      const result = removeAddressPrefix('tltc1qtephp596jhpwrawlp67junuk347zl2cwpucctk')
      expect(result).toEqual('tltc1qtephp596jhpwrawlp67junuk347zl2cwpucctk')
    })

    it('litecoin mainnet', () => {
      const result = removeAddressPrefix('ltc1qtephp596jhpwrawlp67junuk347zl2cwpucctk')
      expect(result).toEqual('ltc1qtephp596jhpwrawlp67junuk347zl2cwpucctk')
    })

    it('cosmos', () => {
      const address = 'cosmos1av54qcmavhjkqsd67cf6f4cedqjrdeh7ed86fc'
      const result = removeAddressPrefix(address)
      expect(result).toEqual(address)
    })
  })

  describe('getETHChecksumAddress', () => {
    it('ethereum uppercase address', () => {
      const result = getEVMChecksumAddress('0x0089D53F703F7E0843953D48133F74CE247184C2')
      expect(result).toEqual(O.some('0x0089d53F703f7E0843953D48133f74cE247184c2'))
    })

    it('ethereum lowercase address', () => {
      const result = getEVMChecksumAddress('0x0089d53f703f7e0843953d48133f74ce247184c2')
      expect(result).toEqual(O.some('0x0089d53F703f7E0843953D48133f74cE247184c2'))
    })

    it('wrong address', () => {
      const result = getEVMChecksumAddress('0x089d53f703f7e48133f74ce247184c2')
      expect(result).toEqual(O.none)
    })

    it('empty address', () => {
      const result = getEVMChecksumAddress('')
      expect(result).toEqual(O.none)
    })
  })

  describe('hasLedgerAddress', () => {
    const addresses: LedgerAddresses = [
      {
        address: 'bsc-address',
        type: WalletType.Ledger,
        keystoreId: 1,
        network: Network.Mainnet,
        chain: BSCChain,
        walletAccount: 0,
        walletIndex: 1,
        hdMode: 'default'
      },
      {
        address: 'eth-address',
        type: WalletType.Ledger,
        keystoreId: 1,
        network: Network.Mainnet,
        chain: ETHChain,
        walletAccount: 0,
        walletIndex: 1,
        hdMode: 'default'
      }
    ]
    it('has ledger BSC', () => {
      expect(hasLedgerAddress(addresses, BSCChain)).toBeTruthy()
    })
    it('has ledger ETH', () => {
      expect(hasLedgerAddress(addresses, ETHChain)).toBeTruthy()
    })
    it('has NOT ledger BTC', () => {
      expect(hasLedgerAddress(addresses, BTCChain)).toBeFalsy()
    })
  })
})
