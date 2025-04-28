import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, BaseAmount } from '@xchainjs/xchain-util'

type UIFee = {
  amount: BaseAmount
  asset: AnyAsset
}

export type UIFees = UIFee[]

export type UIFeesRD = RD.RemoteData<Error, UIFees>
