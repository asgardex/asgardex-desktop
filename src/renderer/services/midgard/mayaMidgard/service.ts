import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Configuration, MidgardApi } from '@xchainjs/xchain-mayamidgard'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ApiUrls } from '../../../../shared/api/types'
import { DEFAULT_MIDGARD_MAYA_URLS, FALLBACK_MIDGARD_MAYA_URLS } from '../../../../shared/mayaMidgard/const'
import { eqApiUrls } from '../../../helpers/fp/eq'
import { liveData } from '../../../helpers/rx/liveData'
import { triggerStream, TriggerStream$ } from '../../../helpers/stateHelper'
import { network$ } from '../../app/service'
import { MIDGARD_MAX_RETRY } from '../../const'
import { inboundAddressesShared$, loadInboundAddresses$ } from '../../mayachain'
import { modifyStorage, getStorageState, midgardMaya$ } from '../../storage/common'
import { ErrorId } from '../../wallet/types'
import {
  NetworkInfoRD,
  NetworkInfoLD,
  MidgardUrlLD,
  HealthLD,
  ValidateNodeLD,
  CheckMidgardUrlHandler,
  SelectedPoolAsset,
  MidgardStatusLD
} from '../midgardTypes'
import { createActionsService } from './actions'
import { selectedPoolAsset$, setSelectedPoolAsset } from './common'
import { createPoolsService } from './pools'
import { createSharesService } from './shares'

// `TriggerStream` to reload Midgard
const { stream$: reloadMayaMidgardUrl$, trigger: reloadMayaMidgardUrl } = triggerStream()

/**
 * Stream of Midgard urls (from storage)
 */
const getMidgardUrl$ = FP.pipe(
  Rx.combineLatest([midgardMaya$, reloadMayaMidgardUrl$]),
  RxOp.map(([midgardMaya, _]) => midgardMaya),
  RxOp.distinctUntilChanged(eqApiUrls.equals)
)
/**
 * Current value of Midgard urls (from storage)
 */
const getMidgardUrl = (): ApiUrls =>
  FP.pipe(
    getStorageState(),
    O.map(({ midgardMaya: midgardUrls }) => midgardUrls),
    O.getOrElse(() => DEFAULT_MIDGARD_MAYA_URLS)
  )

/**
 * Updates Midgard url and stores it persistently
 */
const setMidgardUrl = (url: string, network: Network) => {
  const midgardUrls = { ...getMidgardUrl(), [network]: url }
  modifyStorage(O.some({ midgardMaya: midgardUrls }))
}

/**
 * Helper to get `DefaultApi` instance for Midgard using custom basePath
 */
const getMidgardDefaultApi = (basePath: string) =>
  new MidgardApi(
    new Configuration({
      basePath
    })
  )
/**
 * Probes a Midgard URL via /v2/health. Resolves true when the endpoint reports
 * a healthy database and is in sync with mayanode, false on any error/timeout.
 */
const probeMidgardHealth$ = (url: string): Rx.Observable<boolean> =>
  Rx.from(getMidgardDefaultApi(url).getHealth()).pipe(
    RxOp.timeout(8000),
    RxOp.map(({ data }) => !!data.database && !!data.inSync),
    RxOp.catchError(() => Rx.of(false))
  )

const fallbackUrlForNetwork = (network: Network): string => FALLBACK_MIDGARD_MAYA_URLS[network] ?? ''

// 5-minute interval used for health-driven fallback re-probing + the existing
// healthStatus$ stream. Declared here so midgardUrl$ can reference it.
const healthInterval$ = Rx.timer(0 /* no delay for first value */, 5 * 60 * 1000 /* others are delayed by 5 min  */)

/**
 * Midgard url with transparent fallback.
 *
 * Emits the configured primary URL immediately so cold start isn't delayed.
 * Probes the primary's /v2/health in the background; if unhealthy and a
 * different fallback URL is configured, swaps to the fallback. Re-probes
 * whenever `healthInterval$` triggers, so recovery flips back automatically.
 */
const midgardUrl$: MidgardUrlLD = Rx.combineLatest([network$, getMidgardUrl$, healthInterval$]).pipe(
  RxOp.switchMap(([network, midgardUrl, _]) => {
    const primary = midgardUrl[network]
    const fallback = fallbackUrlForNetwork(network)
    if (!fallback || fallback === primary) return Rx.of(RD.success(primary))
    return Rx.concat(
      Rx.of(RD.success(primary)),
      probeMidgardHealth$(primary).pipe(RxOp.switchMap((ok) => (ok ? Rx.EMPTY : Rx.of(RD.success(fallback)))))
    )
  }),
  RxOp.distinctUntilChanged((a, b) => RD.isSuccess(a) && RD.isSuccess(b) && a.value === b.value),
  RxOp.shareReplay(1)
)

/**
 * Loads data of `NetworkInfo`
 */
const loadNetworkInfo$ = (): Rx.Observable<NetworkInfoRD> =>
  FP.pipe(
    midgardUrl$,
    liveData.chain((endpoint) =>
      FP.pipe(
        Rx.from(getMidgardDefaultApi(endpoint).getNetworkData()), // Convert Promise to Observable
        RxOp.map((response) => RD.success(response.data)), // Extract data from AxiosResponse
        RxOp.startWith(RD.pending),
        RxOp.catchError((e: Error) => Rx.of(RD.failure(e))),
        RxOp.retry(MIDGARD_MAX_RETRY)
      )
    )
  )

// `TriggerStream` to reload `NetworkInfo`
const { stream$: reloadNetworkInfo$, trigger: reloadNetworkInfo } = triggerStream()

/**
 * State of `NetworkInfo`, it will be loaded data by first subscription only
 */
const networkInfo$: NetworkInfoLD = reloadNetworkInfo$.pipe(
  // start request
  RxOp.switchMap(loadNetworkInfo$),
  // cache it to avoid reloading data by every subscription
  RxOp.shareReplay(1)
)

const health$: HealthLD = FP.pipe(
  midgardUrl$,
  liveData.chain((endpoint) =>
    FP.pipe(
      Rx.from(getMidgardDefaultApi(endpoint).getHealth()), // Convert Promise to Observable
      RxOp.map((response) => RD.success(response.data)), // Extract data from AxiosResponse
      RxOp.startWith(RD.pending),
      RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
    )
  )
)

const validateNode$ = (): ValidateNodeLD =>
  health$.pipe(
    liveData.map((_) => true),
    liveData.mapLeft((error) => ({
      errorId: ErrorId.VALIDATE_NODE,
      msg: error?.message ?? error.toString()
    })),
    RxOp.startWith(RD.initial)
  )

// `TriggerStream` to reload chart data handled on view (not service) level only
export const { stream$: reloadChartDataUI$, trigger: reloadChartDataUI } = triggerStream()

export const checkMidgardUrl$: CheckMidgardUrlHandler = (url, intl) =>
  FP.pipe(
    Rx.from(getMidgardDefaultApi(url).getHealth()),
    RxOp.map((result) => {
      const { database, inSync } = result.data
      if (database && inSync) return RD.success(url)

      return RD.failure(
        Error(
          intl?.formatMessage({ id: 'midgard.url.error.unhealthy' }, { endpoint: '/health' }) || 'Midgard is unhealthy'
        )
      )
    }),
    RxOp.catchError((_: Error) =>
      Rx.of(
        RD.failure(Error(`${intl?.formatMessage({ id: 'midgard.url.error.invalid' })} || 'Midgard can't be accessed'`))
      )
    )
  )

const healthStatus$: MidgardStatusLD = FP.pipe(
  Rx.combineLatest([midgardUrl$, healthInterval$]),
  RxOp.map(([urlRD, _]) => urlRD),
  liveData.chain((url) =>
    FP.pipe(
      Rx.from(getMidgardDefaultApi(url).getHealth()),
      RxOp.map((result) => {
        const { database, inSync } = result.data
        return RD.success(database && inSync) // Emit true if healthy, false if unhealthy
      }),
      RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
    )
  )
)

export type MidgardService = {
  networkInfo$: NetworkInfoLD
  reloadNetworkInfo: FP.Lazy<void>
  setSelectedPoolAsset: (p: SelectedPoolAsset) => void
  selectedPoolAsset$: Rx.Observable<SelectedPoolAsset>
  reloadChartDataUI: FP.Lazy<void>
  reloadChartDataUI$: TriggerStream$
  apiEndpoint$: MidgardUrlLD
  reloadApiEndpoint: FP.Lazy<void>
  setMidgardUrl: (url: string, network: Network) => void
  checkMidgardUrl$: CheckMidgardUrlHandler
  pools: ReturnType<typeof createPoolsService>
  shares: ReturnType<typeof createSharesService>
  actions: ReturnType<typeof createActionsService>
  healthStatus$: MidgardStatusLD
  validateNode$: () => ValidateNodeLD
}
/**
 * Service object with all "public" functions and observables we want to provide
 */
export const service: MidgardService = {
  networkInfo$,
  reloadNetworkInfo,
  reloadChartDataUI,
  reloadChartDataUI$,
  setSelectedPoolAsset,
  selectedPoolAsset$,
  apiEndpoint$: midgardUrl$,
  reloadApiEndpoint: reloadMayaMidgardUrl,
  setMidgardUrl,
  checkMidgardUrl$,
  healthStatus$,
  validateNode$,
  pools: createPoolsService({
    midgardUrl$,
    getMidgardDefaultApi,
    selectedPoolAsset$,
    loadInboundAddresses$,
    inboundAddressesShared$
  }),
  shares: createSharesService(midgardUrl$, getMidgardDefaultApi),
  actions: createActionsService(midgardUrl$, getMidgardDefaultApi)
}
