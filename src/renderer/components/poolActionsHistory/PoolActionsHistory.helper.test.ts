import { baseAmount } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'

import { AssetBTC, AssetRuneNative } from '../../../shared/utils/asset'
import { eqAssetsWithAmount } from '../../helpers/fp/eq'
import { Tx } from '../../services/midgard/midgardTypes'
import { Action } from '../../services/midgard/thorMidgard/types'
import { getTxId, getValues, getRowKey, historyFilterToViewblockFilter } from './PoolActionsHistory.helper'

const defaultPoolAction: Action = {
  date: new Date(0),
  in: [],
  out: [],
  type: 'SWAP'
}

const defaultTx: Tx = {
  address: '',
  values: [],
  memo: '',
  txID: ''
}

describe('PoolActionsHistory.helper', () => {
  describe('getTxId', () => {
    it('should return O.none in case there is no info about tx at all', () => {
      expect(getTxId(defaultPoolAction)).toBeNone()
    })

    it('should return the first inbound tx id', () => {
      const firstInTxId = 'first inbound tx id'
      expect(
        getTxId({
          ...defaultPoolAction,
          in: [
            {
              ...defaultTx,
              txID: firstInTxId
            }
          ]
        })
      ).toEqual(O.some(firstInTxId))

      expect(
        getTxId({
          ...defaultPoolAction,
          in: [
            {
              ...defaultTx,
              txID: firstInTxId
            }
          ],
          out: [
            {
              ...defaultTx,
              txID: 'first outbound tx id'
            }
          ]
        })
      ).toEqual(O.some(firstInTxId))

      expect(
        getTxId({
          ...defaultPoolAction,
          in: [
            {
              ...defaultTx,
              txID: firstInTxId
            },
            {
              ...defaultTx,
              txID: 'some another'
            }
          ],
          out: [
            {
              ...defaultTx,
              txID: 'first outbound tx id'
            }
          ]
        })
      ).toEqual(O.some(firstInTxId))
    })

    it('should return the first outbound tx id in case there is no inbound txs', () => {
      const firstOutTxId = 'first inbound tx id'
      expect(
        getTxId({
          ...defaultPoolAction,
          out: [{ ...defaultTx, txID: firstOutTxId }]
        })
      ).toEqual(O.some(firstOutTxId))

      expect(
        getTxId({
          ...defaultPoolAction,
          out: [
            { ...defaultTx, txID: firstOutTxId },
            { ...defaultTx, txID: 'another' }
          ]
        })
      ).toEqual(O.some(firstOutTxId))
    })
  })

  describe('getValues', () => {
    it('should return an empty array for no-values info', () => {
      expect(getValues([defaultTx])).toEqual([])
    })

    it('should return all values for txs', () => {
      const res = getValues([
        { ...defaultTx, values: [{ asset: AssetRuneNative, amount: baseAmount(1) }] },
        {
          ...defaultTx,
          values: [
            { asset: AssetBTC, amount: baseAmount(20) },
            { asset: AssetBTC, amount: baseAmount(30) }
          ]
        },
        { ...defaultTx, values: [{ asset: AssetBTC, amount: baseAmount(100) }] }
      ])
      expect(
        eqAssetsWithAmount.equals(res, [
          { asset: AssetRuneNative, amount: baseAmount(1) },
          { asset: AssetBTC, amount: baseAmount(20) },
          { asset: AssetBTC, amount: baseAmount(30) },
          { asset: AssetBTC, amount: baseAmount(100) }
        ])
      ).toBeTruthy()
    })
  })
  describe('getRowKey', () => {
    it('should return correct id if exists', () => {
      expect(
        getRowKey({
          ...defaultPoolAction,
          in: [
            {
              ...defaultTx,
              txID: 'inId'
            }
          ]
        })
      ).toEqual('inId-SWAP')

      expect(
        getRowKey({
          ...defaultPoolAction,
          out: [
            {
              ...defaultTx,
              txID: 'outId'
            }
          ]
        })
      ).toEqual('outId-SWAP')

      expect(
        getRowKey({
          ...defaultPoolAction,
          in: [
            {
              ...defaultTx,
              txID: 'inId'
            }
          ],
          out: [
            {
              ...defaultTx,
              txID: 'outId'
            }
          ]
        })
      ).toEqual('inId-SWAP')
    })

    it('should return default value in case there is no txId (`action.date-action.type`)', () => {
      // Date(0) is a default date property value for defaultPoolAction
      expect(getRowKey(defaultPoolAction)).toEqual(`${new Date(0)}-SWAP`)
    })
  })

  describe('historyFilterToViewblockFilter', () => {
    it('SWAP', () => {
      expect(historyFilterToViewblockFilter('SWAP')).toEqual('swap')
    })
    it('DEPOSIT', () => {
      expect(historyFilterToViewblockFilter('DEPOSIT')).toEqual('addLiquidity')
    })
    it('DONATE', () => {
      expect(historyFilterToViewblockFilter('DONATE')).toEqual('donate')
    })
    it('REFUND', () => {
      expect(historyFilterToViewblockFilter('REFUND')).toEqual('all')
    })
    it('SEND', () => {
      expect(historyFilterToViewblockFilter('SEND')).toEqual('send')
    })
    it('RUNEPOOLDEPOSIT', () => {
      expect(historyFilterToViewblockFilter('RUNEPOOLDEPOSIT')).toEqual('runePoolDeposit')
    })
    it('ALL', () => {
      expect(historyFilterToViewblockFilter('ALL')).toEqual('all')
    })
    it('UNKNOWN', () => {
      expect(historyFilterToViewblockFilter('UNKNOWN')).toEqual('all')
    })
  })
})
