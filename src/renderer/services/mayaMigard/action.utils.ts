import { Action as ActionAPI, Coin, Transaction } from '@xchainjs/xchain-mayamidgard'
import { assetFromString, baseAmount } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'

import { AssetWithAmount } from '../../types/asgardex'
import { Action, Tx, TxType } from './types'

export const getTxType = (apiString: string): TxType => {
  const type = apiString.toUpperCase()
  switch (type) {
    case 'DEPOSIT':
    case 'SWAP':
    case 'WITHDRAW':
    case 'DONATE':
    case 'REFUND':
    case 'SEND':
    case 'RUNEPOOLDEPOSIT':
      return type
    case 'ADDLIQUIDITY':
      return 'DEPOSIT'
  }
  return 'UNKNOWN'
}

/**
 *
 */
export const getRequestType = (type?: TxType | 'ALL'): string | undefined => {
  switch (type) {
    case 'DEPOSIT': {
      return 'addLiquidity'
    }
    case 'SEND':
    case 'SWAP':
    case 'WITHDRAW':
    case 'DONATE':
    case 'REFUND':
      return type.toLowerCase()
  }
  return
}

export const mapCoin = (coin: Coin): O.Option<AssetWithAmount> => {
  const asset = assetFromString(coin.asset)
  return asset ? O.some({ asset, amount: baseAmount(coin.amount) }) : O.none
}

export const mapTransaction = (tx: Transaction): Tx => ({
  ...tx,
  values: FP.pipe(tx.coins, A.filterMap(mapCoin))
})

export const mapAction = (action: ActionAPI): Action => ({
  ...action,
  type: getTxType(action.type),
  // backend provides date in nanoseconds so we need to divide it by 1 000 000
  date: new Date(Number(action.date) / 1000 / 1000),
  height: FP.pipe(action.height),
  status: FP.pipe(action.status),
  in: FP.pipe(action.in, A.map(mapTransaction)),
  out: FP.pipe(action.out, A.map(mapTransaction))
})
