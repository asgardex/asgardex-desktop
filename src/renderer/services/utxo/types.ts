import * as RD from '@devexperts/remote-data-ts'
import { FeeOption, FeesWithRates } from '@xchainjs/xchain-client'
import { Address, AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import type { UTXO } from '@xchainjs/xchain-utxo-providers'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { LiveData } from '../../helpers/rx/liveData'
import { Memo } from '../chain/types'
import * as C from '../clients'
import type { UtxoSelectionPreferences } from './coinControl.types'

export type FeesWithRatesRD = RD.RemoteData<Error, FeesWithRates>
export type FeesWithRatesLD = LiveData<Error, FeesWithRates>

export type SendTxParams = {
  walletType: WalletType
  asset: AnyAsset
  sender?: Address
  recipient: string
  amount: BaseAmount
  feeRate: number
  feeOption: FeeOption
  memo?: string
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
  sendMax?: boolean
  selectedUtxos?: UTXO[]
  utxoSelectionPreferences?: UtxoSelectionPreferences
}

export type TransactionService = C.TransactionService<SendTxParams>

export type FeesService = C.FeesService & {
  feesWithRates$: (address: string, memo?: Memo) => FeesWithRatesLD
  reloadFeesWithRates: (memo?: Memo) => void
}
