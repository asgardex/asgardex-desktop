import * as Client from '@xchainjs/xchain-client'
import { Network } from '@xchainjs/xchain-client'
import * as Rx from 'rxjs'
import { startWith, mapTo, distinctUntilChanged } from 'rxjs/operators'

import { observableState } from '../../helpers/stateHelper'
import { SlipTolerance } from '../../types/asgardex'
import { DEFAULT_NETWORK, DEFAULT_SLIP_TOLERANCE } from '../const'
import {
  Network$,
  SlipTolerance$,
  OnlineStatus,
  CollapsableSettings,
  SettingType,
  ToggleCollapsableSetting,
  PrivateData$
} from './types'

// Check online status
const online$ = Rx.fromEvent(window, 'online').pipe(mapTo(OnlineStatus.ON))
const offline$ = Rx.fromEvent(window, 'offline').pipe(mapTo(OnlineStatus.OFF))
const onlineStatus$ = Rx.merge(online$, offline$).pipe(startWith(navigator.onLine ? OnlineStatus.ON : OnlineStatus.OFF))

/**
 * State of `Network`
 */
const { get$: getNetwork$, set: changeNetwork, get: getCurrentNetworkState } = observableState<Network>(DEFAULT_NETWORK)

/**
 * State of private Data
 */
const {
  get$: getPrivateData$,
  set: changePrivateData,
  get: getCurrentPrivateDataState
} = observableState<boolean>(false)

// Network and private data streams
const network$: Network$ = getNetwork$.pipe(distinctUntilChanged())
const privateData$: PrivateData$ = getPrivateData$.pipe(distinctUntilChanged())
const clientNetwork$: Rx.Observable<Client.Network> = network$.pipe()

/**
 * State of `Slip` tolerance for different swap types
 */
const { get$: getStreamingSlipTolerance$, set: changeStreamingSlipTolerance } =
  observableState<SlipTolerance>(DEFAULT_SLIP_TOLERANCE)
const streamingSlipTolerance$: SlipTolerance$ = getStreamingSlipTolerance$.pipe(distinctUntilChanged())

const { get$: getTradeSlipTolerance$, set: changeTradeSlipTolerance } =
  observableState<SlipTolerance>(DEFAULT_SLIP_TOLERANCE)
const tradeSlipTolerance$: SlipTolerance$ = getTradeSlipTolerance$.pipe(distinctUntilChanged())

/**
 * State of `collapsed` settings
 */
const {
  get$: collapsedSettings$,
  set: _setCollapsedSettings,
  get: getCollapsedSettings
} = observableState<CollapsableSettings>({
  wallet: false,
  app: false
})

const toggleCollapsedSetting: ToggleCollapsableSetting = (setting: SettingType) => {
  const currentSettings = getCollapsedSettings()
  const currentValue = currentSettings[setting]
  _setCollapsedSettings({ ...currentSettings, [setting]: !currentValue })
}

export {
  onlineStatus$,
  network$,
  changeNetwork,
  getCurrentNetworkState,
  privateData$,
  changePrivateData,
  getCurrentPrivateDataState,
  clientNetwork$,
  streamingSlipTolerance$,
  changeStreamingSlipTolerance,
  tradeSlipTolerance$,
  changeTradeSlipTolerance,
  collapsedSettings$,
  toggleCollapsedSetting
}
