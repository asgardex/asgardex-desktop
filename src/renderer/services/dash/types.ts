import * as RD from '@devexperts/remote-data-ts'
import { FeeRate, FeesWithRates } from '@xchainjs/xchain-client'
import { ClientKeystore as Client } from '@xchainjs/xchain-dash'
import { Address, AnyAsset, BaseAmount } from '@xchainjs/xchain-util'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { LiveData } from '../../helpers/rx/liveData'
import { Memo } from '../chain/types'
import * as C from '../clients'

export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>

export type FeeRateRD = RD.RemoteData<Error, FeeRate>
export type FeeRateLD = LiveData<Error, FeeRate>

export type FeesWithRatesRD = RD.RemoteData<Error, FeesWithRates>
export type FeesWithRatesLD = LiveData<Error, FeesWithRates>

export type SendTxParams = {
  walletType: WalletType
  asset: AnyAsset
  sender?: Address
  recipient: string
  amount: BaseAmount
  feeRate: number
  memo?: string
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}

export type TransactionService = C.TransactionService<SendTxParams>

export type FeesService = C.FeesService & {
  feesWithRates$: (memo?: Memo) => FeesWithRatesLD
  reloadFeesWithRates: (memo?: Memo) => void
}
