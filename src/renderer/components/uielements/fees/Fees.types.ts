import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, BaseAmount } from '@xchainjs/xchain-util'

export type UIFee = {
  amount: BaseAmount
  asset: AnyAsset
}

export type UISwapFees = {
  inbound: UIFee
  priceInbound: UIFee
  outbound: UIFee
  priceOutbound: UIFee
}

export type UIFees = UIFee[]

export type UIFeesRD = RD.RemoteData<Error, UIFees>
export type UISwapFeesRD = RD.RemoteData<Error, UISwapFees>
