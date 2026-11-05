import { ed25519 } from '@noble/curves/ed25519'
import { Network } from '@xchainjs/xchain-client'

import { MIN_COMPACT_RCT_TYPE, verifyOutputCommitment, XMR_H_HEX } from './commitment'
import { deriveXmrViewKeys, bytesToHex } from './derivation'
import { buildPaymentTx, TxForgery } from './fakeDaemon.testHelper'

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const viewKeys = deriveXmrViewKeys(PHRASE, Network.Mainnet)
const AMOUNT = BigInt(1_234_567_890_123)

const txFor = (forge?: TxForgery) => {
  const publicViewKeyHex = bytesToHex(ed25519.ExtendedPoint.BASE.multiply(leBig(viewKeys.privateViewKey)).toRawBytes())
  const tx = buildPaymentTx({ viewKeys, publicViewKeyHex, amount: AMOUNT, forge })
  const txPubKey = Uint8Array.from(tx.extra.slice(1, 33))
  return { tx, txPubKey }
}
const leBig = (b: Uint8Array): bigint => b.reduceRight((acc, v) => (acc << BigInt(8)) | BigInt(v), BigInt(0))

const verify = (forge?: TxForgery, patch?: (rct: Record<string, unknown>) => Record<string, unknown> | undefined) => {
  const { tx, txPubKey } = txFor(forge)
  return verifyOutputCommitment({
    privateViewKey: viewKeys.privateViewKey,
    txPubKey,
    outputIndex: 0,
    rct: patch ? patch({ ...tx.rct_signatures }) : tx.rct_signatures
  })
}

describe('services/monero/commitment', () => {
  describe('H constant (checked against a real mainnet transaction)', () => {
    // tx 78e86c91…c2a6 (RingCT type 6, 1 input, 2 outputs): sum(pseudoOuts) - sum(outPk) == fee·H
    const pseudoOuts = [
      'df46a5d646ae9306bf97e5d510ccdb3a973bd083a30a2aa516f68b0e06cef2c0',
      'a9c9ed969de4b134419a3010edbf32255bcdb108e27f0920eb9f6ce5c9baccd8'
    ]
    const outPk = [
      '49f31fba10972eb7a23c22b197e65415104b6fc16d62ee2f8ecbdc3dc449f638',
      '4fdd47b8e2a0b2bc857799859de18963932dc3e0a051d4cc2370dca4d7dfc32e'
    ]
    const fee = BigInt(44_320_000)
    const P = (hex: string) => ed25519.ExtendedPoint.fromHex(hex)

    it('sum(pseudoOuts) - sum(outPk) == fee·H', () => {
      const sumIn = pseudoOuts.map(P).reduce((a, b) => a.add(b))
      const sumOut = outPk.map(P).reduce((a, b) => a.add(b))
      const H = ed25519.ExtendedPoint.fromHex(XMR_H_HEX)
      expect(sumIn.subtract(sumOut).equals(H.multiply(fee))).toBe(true)
      // and not for the generator G (so the test would notice a wrong H)
      expect(sumIn.subtract(sumOut).equals(ed25519.ExtendedPoint.BASE.multiply(fee))).toBe(false)
    })

    it('H is a valid point of the prime order subgroup', () => {
      const H = ed25519.ExtendedPoint.fromHex(XMR_H_HEX)
      expect(H.isTorsionFree()).toBe(true)
      expect(H.equals(ed25519.ExtendedPoint.BASE)).toBe(false)
    })
  })

  describe('verifyOutputCommitment', () => {
    it('valid commitment: returns the amount decrypted by us', () => {
      expect(verify()).toEqual({ ok: true, amount: AMOUNT })
    })

    it('forged amount (ecdhInfo claims 10x what outPk commits to): rejected, not credited', () => {
      expect(verify('inflated-ecdh')).toEqual({ ok: false, reason: 'commitment-mismatch' })
    })

    it('forged outPk (commits to another amount): rejected', () => {
      expect(verify('wrong-outpk')).toEqual({ ok: false, reason: 'commitment-mismatch' })
    })

    it('missing outPk: rejected as missing-commitment (never 0, never credited)', () => {
      expect(verify('missing-outpk')).toEqual({ ok: false, reason: 'missing-commitment' })
      expect(verify(undefined, (rct) => ({ ...rct, outPk: undefined }))).toEqual({
        ok: false,
        reason: 'missing-commitment'
      })
      expect(verify(undefined, (rct) => ({ ...rct, outPk: ['not hex'] }))).toEqual({
        ok: false,
        reason: 'missing-commitment'
      })
    })

    it('outPk of another output index does not count', () => {
      const { tx, txPubKey } = txFor()
      expect(
        verifyOutputCommitment({
          privateViewKey: viewKeys.privateViewKey,
          txPubKey,
          outputIndex: 1,
          rct: tx.rct_signatures
        })
      ).toEqual({ ok: false, reason: 'missing-commitment' })
    })

    it('pre-RingCT / old formats (type < 4) and missing rct data: rejected explicitly, not counted as 0', () => {
      expect(MIN_COMPACT_RCT_TYPE).toBe(4)
      expect(verify('old-type')).toEqual({ ok: false, reason: 'unsupported-tx-type' })
      expect(verify(undefined, (rct) => ({ ...rct, type: 0 }))).toEqual({ ok: false, reason: 'unsupported-tx-type' })
      expect(verify(undefined, () => undefined)).toEqual({ ok: false, reason: 'unsupported-tx-type' })
      expect(verify(undefined, (rct) => ({ ...rct, type: '6' }))).toEqual({
        ok: false,
        reason: 'unsupported-tx-type'
      })
    })

    it('undecryptable: missing / malformed ecdhInfo, or an invalid tx public key', () => {
      expect(verify(undefined, (rct) => ({ ...rct, ecdhInfo: [] }))).toEqual({ ok: false, reason: 'undecryptable' })
      expect(verify(undefined, (rct) => ({ ...rct, ecdhInfo: [{ amount: 'zz' }] }))).toEqual({
        ok: false,
        reason: 'undecryptable'
      })
      const { tx } = txFor()
      expect(
        verifyOutputCommitment({
          privateViewKey: viewKeys.privateViewKey,
          txPubKey: new Uint8Array(32).fill(0xff),
          outputIndex: 0,
          rct: tx.rct_signatures
        })
      ).toEqual({ ok: false, reason: 'undecryptable' })
    })

    it('a tampered ecdhInfo (any bit) is rejected', () => {
      const { tx } = txFor()
      const enc = tx.rct_signatures.ecdhInfo[0].amount
      const flipped = (parseInt(enc.slice(0, 2), 16) ^ 1).toString(16).padStart(2, '0') + enc.slice(2)
      expect(verify(undefined, (rct) => ({ ...rct, ecdhInfo: [{ amount: flipped }] }))).toEqual({
        ok: false,
        reason: 'commitment-mismatch'
      })
    })

    it('zero amounts verify as zero (commitment to 0 is valid)', () => {
      const publicViewKeyHex = bytesToHex(
        ed25519.ExtendedPoint.BASE.multiply(leBig(viewKeys.privateViewKey)).toRawBytes()
      )
      const tx = buildPaymentTx({ viewKeys, publicViewKeyHex, amount: BigInt(0) })
      expect(
        verifyOutputCommitment({
          privateViewKey: viewKeys.privateViewKey,
          txPubKey: Uint8Array.from(tx.extra.slice(1, 33)),
          outputIndex: 0,
          rct: tx.rct_signatures
        })
      ).toEqual({ ok: true, amount: BigInt(0) })
    })
  })
})
