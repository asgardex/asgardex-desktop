import * as RD from '@devexperts/remote-data-ts'

import { LiveData } from '../../../helpers/rx/liveData'
import { AssetWithAmount } from '../../../types/asgardex'
import { Memo } from '../../chain/types'
import { ApiError } from '../../wallet/types'
import { TxType } from '../midgardTypes'

export type Tx = {
  // Sender address
  address: string
  values: AssetWithAmount[]
  memo?: Memo
  /**
   * Transaction id hash. Some transactions (such as outbound transactions made in the native asset) may have a zero value.
   */
  txID: string
}
export type Action = {
  date: Date
  /**
   * Inbound transactions related to the action
   */
  in: Tx[]
  /**
   * Outbound transactions related to the action
   */
  out: Tx[]
  type: TxType
  fees?: AssetWithAmount[]
  slip?: number
}

export type Actions = Action[]

export type ActionsPage = {
  total: number
  actions: Actions
}

export type ActionsPageRD = RD.RemoteData<ApiError, ActionsPage>
export type ActionsPageLD = LiveData<ApiError, ActionsPage>
