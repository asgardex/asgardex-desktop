import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'

import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import { ApiError } from '../../../services/wallet/types'
import { AssetData } from './extra/Common.types'

export type TxConfig =
  | {
      type: 'swap'
      source: AssetData
      target: AssetData
      protocol?: O.Option<string>
      channelId?: O.Option<string>
    }
  | { type: 'send'; asset: AssetData }
  | {
      type: 'deposit'
      asset: AssetData
      steps: { current: number; total: number }
      stepDescriptions: string[]
    }
  | {
      type: 'symDeposit'
      source: O.Option<AssetData>
      target: AssetData
      steps: { current: number; total: number }
      stepDescriptions: string[]
    }
  | { type: 'interact'; asset: AssetData }
  | { type: 'withdraw'; source: O.Option<AssetData>; target: AssetData }
  | { type: 'claim'; source: O.Option<AssetData> }

export type TxModalProps = {
  txRD: RD.RemoteData<ApiError, boolean>
  timerValue?: number
  startTime?: number
  txConfig: TxConfig
  title?: string
  txHash: O.Option<TxHash>
  getExplorerTxUrl: GetExplorerTxUrl
  openExplorerTxUrl: OpenExplorerTxUrl
  network: Network
  trackable?: boolean
  onClose: FP.Lazy<void>
  onFinish: FP.Lazy<void>
  extraContent?: React.ReactNode
}
