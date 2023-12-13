import * as Rx from 'rxjs'

import { Dex, Network } from '../../../shared/api/types'
import { SlipTolerance } from '../../types/asgardex'

export enum OnlineStatus {
  ON = 'online',
  OFF = 'offline'
}

export type ChangeNetworkHandler = (network: Network) => void
export type ChangeDexHandler = (dex: Dex) => void
export type ChangePrivateDataHandler = (value: boolean) => void
export type Network$ = Rx.Observable<Network>
export type Dex$ = Rx.Observable<Dex>
export type PrivateData$ = Rx.Observable<boolean>

export type ChangeSlipToleranceHandler = (slip: SlipTolerance) => void
export type SlipTolerance$ = Rx.Observable<SlipTolerance>

export type SettingType = 'app' | 'wallet'
export type CollapsableSettings = Record<SettingType, boolean>
export type ToggleCollapsableSetting = (setting: SettingType) => void
