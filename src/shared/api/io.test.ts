import { fail } from 'assert'

import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { baseAmount } from '@xchainjs/xchain-util'
import * as E from 'fp-ts/lib/Either'
import * as FP from 'fp-ts/lib/function'

import { eqBaseAmount } from '../../renderer/helpers/fp/eq'
import { MOCK_KEYSTORE } from '../mock/wallet'
import { mapIOErrors } from '../utils/fp'
import {
  BaseAmountEncoded,
  baseAmountIO,
  IPCLedgerAddressesIO,
  ipcKeystoreWalletIO,
  ipcLedgerAddressesIO,
  isBaseAmountEncoded,
  keystoreIO,
  KeystoreWallet
} from './io'

describe('shared/io', () => {
  describe('isBaseAmountEncoded', () => {
    it('true', () => {
      const encoded = {
        amount: '1',
        decimal: 10
      }
      expect(isBaseAmountEncoded(encoded)).toBeTruthy()
    })
    it('false - no amount', () => {
      const encoded = {
        decimal: 10
      }
      expect(isBaseAmountEncoded(encoded)).toBeFalsy()
    })
    it('false - no decimal', () => {
      const encoded = {
        amount: '1'
      }
      expect(isBaseAmountEncoded(encoded)).toBeFalsy()
    })
    it('false misc.', () => {
      expect(isBaseAmountEncoded(null)).toBeFalsy()
      expect(isBaseAmountEncoded(undefined)).toBeFalsy()
      expect(isBaseAmountEncoded(1)).toBeFalsy()
      expect(isBaseAmountEncoded(true)).toBeFalsy()
      expect(isBaseAmountEncoded(false)).toBeFalsy()
      expect(isBaseAmountEncoded('')).toBeFalsy()
      expect(isBaseAmountEncoded('hello-world')).toBeFalsy()
      expect(
        isBaseAmountEncoded({
          hello: 'world'
        })
      ).toBeFalsy()
    })
  })
  describe('baseAmountIO', () => {
    it('encode BaseAmount', () => {
      const encoded = baseAmountIO.encode(baseAmount(1, 18))
      expect(encoded).toEqual({ amount: '1', decimal: 18 })
    })
    it('decode BaseAmount', () => {
      const encoded: BaseAmountEncoded = { amount: '1', decimal: 18 }
      const decoded = baseAmountIO.decode(encoded)
      expect(E.isRight(decoded)).toBeTruthy()

      FP.pipe(
        decoded,
        E.fold(
          (errors) => {
            fail(mapIOErrors(errors))
          },
          (r) => {
            expect(eqBaseAmount.equals(r, baseAmount(1, 18))).toBeTruthy()
          }
        )
      )
    })
  })

  describe('keystoreIO', () => {
    it('decoded', () => {
      const data = JSON.parse(JSON.stringify(MOCK_KEYSTORE))

      const decoded = keystoreIO.decode(data)

      FP.pipe(
        decoded,
        E.fold(
          (errors) => {
            fail(mapIOErrors(errors))
          },
          (result) => {
            expect(result).toEqual(MOCK_KEYSTORE)
          }
        )
      )
    })

    it('encode', () => {
      const encoded = keystoreIO.encode(MOCK_KEYSTORE)
      expect(encoded).toEqual(JSON.parse(JSON.stringify(MOCK_KEYSTORE)))
    })
  })

  describe('ipcKeystoreWalletIO', () => {
    const keystoreWallet: KeystoreWallet = {
      id: 1,
      name: 'wallet1',
      selected: true,
      keystore: MOCK_KEYSTORE
    }
    it('decoded', () => {
      const data = JSON.parse(JSON.stringify(keystoreWallet))

      const decoded = ipcKeystoreWalletIO.decode(data)

      FP.pipe(
        decoded,
        E.fold(
          (errors) => {
            fail(mapIOErrors(errors))
          },
          (result) => {
            expect(result).toEqual(keystoreWallet)
          }
        )
      )
    })
    it('encode', () => {
      const encoded = ipcKeystoreWalletIO.encode(keystoreWallet)
      expect(encoded).toEqual(JSON.parse(JSON.stringify(keystoreWallet)))
    })
    it('round-trip', () => {
      const encoded = ipcKeystoreWalletIO.encode(keystoreWallet)
      const decoded = ipcKeystoreWalletIO.decode(encoded)

      FP.pipe(
        decoded,
        E.fold(
          (errors) => {
            fail(mapIOErrors(errors))
          },
          (result) => {
            expect(result).toEqual(keystoreWallet)
          }
        )
      )
    })
  })
})
describe('ipcKeystorLedgerAddressesIO', () => {
  const ledgers: IPCLedgerAddressesIO = [
    {
      keystoreId: 1,
      chain: ETHChain,
      network: Network.Mainnet,
      address: 'eth-address',
      walletIndex: 1,
      hdMode: 'metamask'
    }
  ]

  it('decoded', () => {
    const data = JSON.parse(JSON.stringify(ledgers))

    const decoded = ipcLedgerAddressesIO.decode(data)

    FP.pipe(
      decoded,
      E.fold(
        (errors) => {
          fail(mapIOErrors(errors))
        },
        (result) => {
          expect(result).toEqual(ledgers)
        }
      )
    )
  })
  it('encode', () => {
    const encoded = ipcLedgerAddressesIO.encode(ledgers)
    expect(encoded).toEqual(JSON.parse(JSON.stringify(ledgers)))
  })

  it('round-trip', () => {
    const encoded = ipcLedgerAddressesIO.encode(ledgers)
    const decoded = ipcLedgerAddressesIO.decode(encoded)

    FP.pipe(
      decoded,
      E.fold(
        (errors) => {
          fail(mapIOErrors(errors))
        },
        (result) => {
          expect(result).toEqual(ledgers)
        }
      )
    )
  })
})
