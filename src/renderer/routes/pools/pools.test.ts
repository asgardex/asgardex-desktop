import { WalletType } from '../../../shared/wallet/types'
import { base, pending, active, deposit, swap, detail } from './index'
import { sourceHdModeFromQuery } from './swap'

describe('Pools routes', () => {
  describe('base route', () => {
    it('template', () => {
      expect(base.template).toEqual('/pools')
    })
    it('path', () => {
      expect(base.path()).toEqual('/pools')
    })
  })

  describe('active', () => {
    it('template', () => {
      expect(active.template).toEqual('/pools/active')
    })
    it('path', () => {
      expect(active.path()).toEqual('/pools/active')
    })
  })

  describe('pending', () => {
    it('template', () => {
      expect(pending.template).toEqual('/pools/pending')
    })
    it('path', () => {
      expect(pending.path()).toEqual('/pools/pending')
    })
  })

  describe('Deposit routes', () => {
    it('template', () => {
      expect(deposit.template).toEqual('/pools/deposit/:asset/:assetWalletType/:runeWalletType')
    })
    it('asset - keystore | rune - keystore', () => {
      expect(
        deposit.path({ asset: 'BSC.BNB', assetWalletType: WalletType.Keystore, dexWalletType: WalletType.Keystore })
      ).toEqual('/pools/deposit/BSC.BNB/keystore/keystore')
    })
    it('asset - ledger | rune - keystore', () => {
      expect(
        deposit.path({ asset: 'BSC.BNB', assetWalletType: WalletType.Ledger, dexWalletType: WalletType.Keystore })
      ).toEqual('/pools/deposit/BSC.BNB/ledger/keystore')
    })
    it('asset - keystore | rune - ledger', () => {
      expect(
        deposit.path({ asset: 'BSC.BNB', assetWalletType: WalletType.Keystore, dexWalletType: WalletType.Ledger })
      ).toEqual('/pools/deposit/BSC.BNB/keystore/ledger')
    })
    it('asset - ledger | rune - ledger', () => {
      expect(
        deposit.path({ asset: 'BSC.BNB', assetWalletType: WalletType.Ledger, dexWalletType: WalletType.Ledger })
      ).toEqual('/pools/deposit/BSC.BNB/ledger/ledger')
    })
    it('redirects for empty assets', () => {
      expect(
        deposit.path({ asset: '', assetWalletType: WalletType.Keystore, dexWalletType: WalletType.Keystore })
      ).toEqual('/pools/deposit')
    })
  })

  describe('Swap routes', () => {
    it('template', () => {
      expect(swap.template).toEqual('/pools/swap/:source/:sourceWalletType/:target/:targetWalletType/:recipient?')
    })
    it('source keystore / target keystore', () => {
      expect(
        swap.path({
          source: 'BSC.BNB',
          sourceWalletType: WalletType.Keystore,
          target: 'THOR.RUNE',
          targetWalletType: WalletType.Keystore
        })
      ).toEqual('/pools/swap/BSC.BNB/keystore/THOR.RUNE/keystore')
    })
    it('source ledger / target keystore', () => {
      expect(
        swap.path({
          source: 'BSC.BNB',
          sourceWalletType: WalletType.Ledger,
          target: 'THOR.RUNE',
          targetWalletType: WalletType.Keystore
        })
      ).toEqual('/pools/swap/BSC.BNB/ledger/THOR.RUNE/keystore')
    })
    it('source keystore / target ledger', () => {
      expect(
        swap.path({
          source: 'BSC.BNB',
          sourceWalletType: WalletType.Keystore,
          target: 'THOR.RUNE',
          targetWalletType: WalletType.Ledger
        })
      ).toEqual('/pools/swap/BSC.BNB/keystore/THOR.RUNE/ledger')
    })
    it('source ledger / target ledger', () => {
      expect(
        swap.path({
          source: 'BTC.BTC',
          sourceWalletType: WalletType.Ledger,
          target: 'ETH.ETH',
          targetWalletType: WalletType.Ledger
        })
      ).toEqual('/pools/swap/BTC.BTC/ledger/ETH.ETH/ledger')
    })
    it('redirects if source is empty', () => {
      expect(
        swap.path({
          source: '',
          target: 'THOR.RUNE',
          sourceWalletType: WalletType.Keystore,
          targetWalletType: WalletType.Keystore
        })
      ).toEqual('/pools/swap')
    })
    it('redirects if target is empty', () => {
      expect(
        swap.path({
          source: 'BSC.BNB',
          target: '',
          sourceWalletType: WalletType.Keystore,
          targetWalletType: WalletType.Keystore
        })
      ).toEqual('/pools/swap')
    })
    it('names the taproot wallet on a BTC swap', () => {
      expect(
        swap.path({
          source: 'BTC.BTC',
          sourceWalletType: WalletType.Keystore,
          target: 'ETH.ETH',
          targetWalletType: WalletType.Keystore,
          sourceHdMode: 'p2tr'
        })
      ).toEqual('/pools/swap/BTC.BTC/keystore/ETH.ETH/keystore?sourceHdMode=p2tr')
    })
    it('keeps the taproot wallet when a recipient is set', () => {
      expect(
        swap.path({
          source: 'BTC.BTC',
          sourceWalletType: WalletType.Keystore,
          target: 'ETH.ETH',
          targetWalletType: WalletType.Keystore,
          recipient: '0xabc',
          sourceHdMode: 'p2tr'
        })
      ).toEqual('/pools/swap/BTC.BTC/keystore/ETH.ETH/keystore/0xabc?sourceHdMode=p2tr')
    })
    it('leaves native segwit on the plain BTC path', () => {
      expect(
        swap.path({
          source: 'BTC.BTC',
          sourceWalletType: WalletType.Keystore,
          target: 'ETH.ETH',
          targetWalletType: WalletType.Keystore,
          sourceHdMode: 'p2wpkh'
        })
      ).toEqual('/pools/swap/BTC.BTC/keystore/ETH.ETH/keystore')
    })
    it('reads a taproot source only for BTC', () => {
      expect(sourceHdModeFromQuery('BTC', 'p2tr')).toEqual('p2tr')
      expect(sourceHdModeFromQuery('BTC', 'p2wpkh')).toBeUndefined()
      expect(sourceHdModeFromQuery('ETH', 'p2tr')).toBeUndefined()
      expect(sourceHdModeFromQuery('BTC', null)).toBeUndefined()
    })
    it('names a taproot destination', () => {
      expect(
        swap.path({
          source: 'ETH.ETH',
          sourceWalletType: WalletType.Keystore,
          target: 'BTC.BTC',
          targetWalletType: WalletType.Keystore,
          targetHdMode: 'p2tr'
        })
      ).toEqual('/pools/swap/ETH.ETH/keystore/BTC.BTC/keystore?targetHdMode=p2tr')
    })
    it('keeps both taproot wallets in the query', () => {
      expect(
        swap.path({
          source: 'BTC.BTC',
          sourceWalletType: WalletType.Keystore,
          target: 'BTC.BTC',
          targetWalletType: WalletType.Keystore,
          sourceHdMode: 'p2tr',
          targetHdMode: 'p2tr'
        })
      ).toEqual('/pools/swap/BTC.BTC/keystore/BTC.BTC/keystore?sourceHdMode=p2tr&targetHdMode=p2tr')
    })
  })

  describe('PoolDetail routes', () => {
    it('template', () => {
      expect(detail.template).toEqual('/pools/detail/:asset')
    })
    it('returns path by given asset parameter', () => {
      expect(detail.path({ asset: 'BSC.BNB' })).toEqual('/pools/detail/BSC.BNB')
    })
    it('redirects to pools base path if symbol is empty', () => {
      expect(detail.path({ asset: '' })).toEqual('/pools')
    })
  })
})
