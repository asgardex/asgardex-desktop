import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ADAChain } from '@xchainjs/xchain-cardano'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { SOLChain } from '@xchainjs/xchain-solana'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { TRONChain } from '@xchainjs/xchain-tron'
import { Address, Chain } from '@xchainjs/xchain-util'
import { ZECChain } from '@xchainjs/xchain-zcash'
import { array as A, function as FP, nonEmptyArray as NEA, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isSupportedChain } from '../../../shared/utils/chain'
import { HDMode, WalletAddress, WalletBalanceType, WalletType } from '../../../shared/wallet/types'
import { eqBalancesRD } from '../../helpers/fp/eq'
import { sequenceTOptionFromArray } from '../../helpers/fpHelpers'
import { liveData } from '../../helpers/rx/liveData'
import { Network$ } from '../app/types'
import * as ARB from '../arb'
import * as AVAX from '../avax'
import * as BASE from '../base'
import * as BTC from '../bitcoin'
import * as BCH from '../bitcoincash'
import * as BSC from '../bsc'
import * as ADA from '../cardano'
import { WalletBalancesLD, WalletBalancesRD } from '../clients'
import * as COSMOS from '../cosmos'
import * as DASH from '../dash'
import * as DOGE from '../doge'
import * as ETH from '../ethereum'
import * as KUJI from '../kuji'
import * as LTC from '../litecoin'
import * as MAYA from '../mayachain'
import * as XRD from '../radix'
import * as XRP from '../ripple'
import * as SOL from '../solana'
import * as THOR from '../thorchain'
import * as TRON from '../tron'
import * as ZEC from '../zcash'
import { INITIAL_BALANCES_STATE } from './const'
import {
  ChainBalances$,
  ChainBalance$,
  BalancesService,
  ChainBalancesService,
  BalancesState$,
  KeystoreState$,
  KeystoreState,
  ChainBalance,
  GetLedgerAddressHandler,
  StandaloneLedgerState,
  getWalletTypeFromState
} from './types'
import { hasImportedKeystore } from './util'

export const createBalancesService = ({
  keystore$,
  network$,
  getLedgerAddress$,
  userChains$,
  appWalletService,
  isStandaloneLedgerMode
}: {
  keystore$: KeystoreState$
  network$: Network$
  getLedgerAddress$: GetLedgerAddressHandler
  userChains$: Rx.Observable<string[]>
  appWalletService: import('./types').AppWalletService
  isStandaloneLedgerMode: (state: import('./types').AppWalletState) => boolean
}): BalancesService => {
  // Concurrency limit for balance requests - process in batches to prevent overwhelming APIs
  const BALANCE_BATCH_SIZE = 5
  const BATCH_DELAY_MS = 100

  /**
   * Process balance reloads in batches with a delay between batches
   * This prevents overwhelming network/APIs with too many concurrent requests
   */
  const processBatchedReloads = (reloadFunctions: Array<() => void>): void => {
    if (reloadFunctions.length === 0) return

    // Process first batch immediately
    const firstBatch = reloadFunctions.slice(0, BALANCE_BATCH_SIZE)
    firstBatch.forEach((fn) => fn())

    // Process remaining batches with delays
    const remaining = reloadFunctions.slice(BALANCE_BATCH_SIZE)
    remaining.forEach((fn, index) => {
      const batchIndex = Math.floor(index / BALANCE_BATCH_SIZE)
      const delay = (batchIndex + 1) * BATCH_DELAY_MS
      setTimeout(fn, delay)
    })
  }

  // reload all balances - derives wallet type from appWalletState$
  const reloadBalances: FP.Lazy<void> = () => {
    Rx.combineLatest([userChains$, appWalletService.appWalletState$])
      .pipe(RxOp.take(1))
      .subscribe(([enabledChains, appWalletState]) => {
        const walletType = getWalletTypeFromState(appWalletState)
        // Convert to Set for O(1) lookups instead of O(n) .includes() calls
        const enabledChainsSet = new Set(enabledChains)

// Collect all enabled reload functions (using Set for O(1) lookups)
        const reloadFunctions: Array<() => void> = []

        if (enabledChainsSet.has(BTCChain)) reloadFunctions.push(() => BTC.reloadBalances(walletType))
        if (enabledChainsSet.has(DASHChain)) reloadFunctions.push(() => DASH.reloadBalances(walletType))
        if (enabledChainsSet.has(BCHChain)) reloadFunctions.push(() => BCH.reloadBalances(walletType))
        if (enabledChainsSet.has(ETHChain)) reloadFunctions.push(() => ETH.reloadBalances(walletType))
        if (enabledChainsSet.has(ARBChain)) reloadFunctions.push(() => ARB.reloadBalances(walletType))
        if (enabledChainsSet.has(AVAXChain)) reloadFunctions.push(() => AVAX.reloadBalances(walletType))
        if (enabledChainsSet.has(BASEChain)) reloadFunctions.push(() => BASE.reloadBalances(walletType))
        if (enabledChainsSet.has(BSCChain)) reloadFunctions.push(() => BSC.reloadBalances(walletType))
        if (enabledChainsSet.has(THORChain)) reloadFunctions.push(() => THOR.reloadBalances(walletType))
        if (enabledChainsSet.has(MAYAChain)) reloadFunctions.push(() => MAYA.reloadBalances())
        if (enabledChainsSet.has(LTCChain)) reloadFunctions.push(() => LTC.reloadBalances(walletType))
        if (enabledChainsSet.has(DOGEChain)) reloadFunctions.push(() => DOGE.reloadBalances(walletType))
        if (enabledChainsSet.has(GAIAChain)) reloadFunctions.push(() => COSMOS.reloadBalances(walletType))
        if (enabledChainsSet.has(KUJIChain)) reloadFunctions.push(() => KUJI.reloadBalances())
        if (enabledChainsSet.has(ADAChain)) reloadFunctions.push(() => ADA.reloadBalances())
        if (enabledChainsSet.has(XRPChain)) reloadFunctions.push(() => XRP.reloadBalances(walletType))
        if (enabledChainsSet.has(RadixChain)) reloadFunctions.push(() => XRD.reloadBalances())
        if (enabledChainsSet.has(SOLChain)) reloadFunctions.push(() => SOL.reloadBalances())
        if (enabledChainsSet.has(TRONChain)) reloadFunctions.push(() => TRON.reloadBalances(walletType))
        if (enabledChainsSet.has(ZECChain)) reloadFunctions.push(() => ZEC.reloadBalances(walletType))

        // Process in batches to limit concurrency
        processBatchedReloads(reloadFunctions)
      })
  }

  // Returns lazy functions to reload balances by given chain
  const chainReloadBalances: Record<Chain, (walletType: WalletType) => void> = {
    [BTCChain]: BTC.reloadBalances,
    [DASHChain]: DASH.reloadBalances,
    [BCHChain]: BCH.reloadBalances,
    [ETHChain]: (walletType) => ETH.reloadBalances(walletType), // Accept walletType
    [ARBChain]: ARB.reloadBalances,
    [AVAXChain]: AVAX.reloadBalances,
    [BSCChain]: BSC.reloadBalances,
    [THORChain]: THOR.reloadBalances,
    [MAYAChain]: MAYA.reloadBalances,
    [LTCChain]: LTC.reloadBalances,
    [DOGEChain]: DOGE.reloadBalances,
    [KUJIChain]: KUJI.reloadBalances,
    [GAIAChain]: COSMOS.reloadBalances,
    [RadixChain]: XRD.reloadBalances,
    [SOLChain]: SOL.reloadBalances,
    [BASEChain]: BASE.reloadBalances,
    [ADAChain]: ADA.reloadBalances,
    [TRONChain]: TRON.reloadBalances,
    [ZECChain]: ZEC.reloadBalances,
    [XRPChain]: XRP.reloadBalances
  }

  const reloadBalancesByChain =
    (chain: Chain, walletType: WalletType): FP.Lazy<void> =>
    () => {
      userChains$
        .pipe(
          RxOp.take(1),
          RxOp.map((enabledChains) => {
            if (!enabledChains.includes(chain)) {
              return FP.constVoid
            }

            const reloadBalances = chainReloadBalances[chain]
            if (!reloadBalances) {
              return FP.constVoid
            }

            return () => reloadBalances(walletType) // Pass walletType dynamically
          }),
          RxOp.shareReplay(1) // Cache the latest result for multiple subscribers
        )
        .subscribe((reloadFunction) => {
          if (reloadFunction !== FP.constVoid) {
            reloadFunction()
          }
        })
    }

  const getBalancesServiceByChain = ({
    chain,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletBalanceType
  }: {
    chain: Chain
    walletType: WalletType
    walletAccount: number
    walletIndex: number
    hdMode: HDMode
    walletBalanceType: WalletBalanceType
  }): ChainBalancesService => {
    const chainInUserChains$ = userChains$.pipe(RxOp.map((enabledChains) => enabledChains.includes(chain)))

    if (!isSupportedChain(chain)) {
      return {
        reloadBalances: FP.constVoid,
        resetReloadBalances: FP.constVoid,
        balances$: Rx.EMPTY,
        reloadBalances$: Rx.EMPTY
      }
    }

    if (chainInUserChains$) {
      switch (chain) {
        case BTCChain:
          return {
            reloadBalances: () => BTC.reloadBalances(walletType),
            resetReloadBalances: () => BTC.resetReloadBalances(walletType),
            balances$: BTC.balances$({ walletType, walletAccount, walletIndex, walletBalanceType, hdMode }),
            reloadBalances$: BTC.reloadBalances$
          }
        case DASHChain:
          return {
            reloadBalances: () => DASH.reloadBalances(walletType),
            resetReloadBalances: () => DASH.resetReloadBalances(walletType),
            balances$: DASH.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: DASH.reloadBalances$
          }
        case BCHChain:
          return {
            reloadBalances: () => BCH.reloadBalances(walletType),
            resetReloadBalances: () => BCH.resetReloadBalances(walletType),
            balances$: BCH.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: BCH.reloadBalances$
          }
        case ETHChain:
          return {
            reloadBalances: () => ETH.reloadBalances(walletType),
            resetReloadBalances: () => ETH.resetReloadBalances(walletType),
            balances$: FP.pipe(
              network$,
              RxOp.switchMap((network) => ETH.balances$({ walletType, network, walletAccount, walletIndex, hdMode }))
            ),
            reloadBalances$: ETH.reloadBalances$
          }
        case ARBChain:
          return {
            reloadBalances: () => ARB.reloadBalances(walletType),
            resetReloadBalances: () => ARB.resetReloadBalances(walletType),
            balances$: FP.pipe(
              network$,
              RxOp.switchMap((network) => ARB.balances$({ walletType, network, walletAccount, walletIndex, hdMode }))
            ),
            reloadBalances$: ARB.reloadBalances$
          }
        case AVAXChain:
          return {
            reloadBalances: () => AVAX.reloadBalances(walletType),
            resetReloadBalances: () => AVAX.resetReloadBalances(walletType),
            balances$: FP.pipe(
              network$,
              RxOp.switchMap((network) => AVAX.balances$({ walletType, network, walletAccount, walletIndex, hdMode }))
            ),
            reloadBalances$: AVAX.reloadBalances$
          }
        case BASEChain:
          return {
            reloadBalances: () => BASE.reloadBalances(walletType),
            resetReloadBalances: () => BASE.resetReloadBalances(walletType),
            balances$: FP.pipe(
              network$,
              RxOp.switchMap((network) => BASE.balances$({ walletType, network, walletAccount, walletIndex, hdMode }))
            ),
            reloadBalances$: BASE.reloadBalances$
          }
        case BSCChain:
          return {
            reloadBalances: () => BSC.reloadBalances(walletType),
            resetReloadBalances: () => BSC.resetReloadBalances(walletType),
            balances$: FP.pipe(
              network$,
              RxOp.switchMap((network) => BSC.balances$({ walletType, network, walletAccount, walletIndex, hdMode }))
            ),
            reloadBalances$: BSC.reloadBalances$
          }
        case THORChain:
          return {
            reloadBalances: () => THOR.reloadBalances(walletType),
            resetReloadBalances: () => THOR.resetReloadBalances(walletType),
            balances$: THOR.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: THOR.reloadBalances$
          }
        case MAYAChain:
          return {
            reloadBalances: MAYA.reloadBalances,
            resetReloadBalances: MAYA.resetReloadBalances,
            balances$: MAYA.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: MAYA.reloadBalances$
          }
        case LTCChain:
          return {
            reloadBalances: () => LTC.reloadBalances(walletType),
            resetReloadBalances: () => LTC.resetReloadBalances(walletType),
            balances$: LTC.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: LTC.reloadBalances$
          }
        case DOGEChain:
          return {
            reloadBalances: () => DOGE.reloadBalances(walletType),
            resetReloadBalances: () => DOGE.resetReloadBalances(walletType),
            balances$: DOGE.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: DOGE.reloadBalances$
          }
        case KUJIChain:
          return {
            reloadBalances: KUJI.reloadBalances,
            resetReloadBalances: KUJI.resetReloadBalances,
            balances$: KUJI.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: KUJI.reloadBalances$
          }
        case ADAChain:
          return {
            reloadBalances: ADA.reloadBalances,
            resetReloadBalances: ADA.resetReloadBalances,
            balances$: ADA.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: ADA.reloadBalances$
          }
        case GAIAChain:
          return {
            reloadBalances: () => COSMOS.reloadBalances(walletType),
            resetReloadBalances: () => COSMOS.resetReloadBalances(walletType),
            balances$: COSMOS.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: COSMOS.reloadBalances$
          }
        case RadixChain:
          return {
            reloadBalances: XRD.reloadBalances,
            resetReloadBalances: XRD.resetReloadBalances,
            balances$: XRD.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: XRD.reloadBalances$
          }
        case SOLChain:
          return {
            reloadBalances: SOL.reloadBalances,
            resetReloadBalances: SOL.resetReloadBalances,
            balances$: SOL.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: SOL.reloadBalances$
          }
        case TRONChain:
          return {
            reloadBalances: () => TRON.reloadBalances(walletType),
            resetReloadBalances: () => TRON.resetReloadBalances(walletType),
            balances$: FP.pipe(
              network$,
              RxOp.switchMap((network) => TRON.balances$({ walletType, network, walletAccount, walletIndex, hdMode }))
            ),
            reloadBalances$: TRON.reloadBalances$
          }
        case ZECChain:
          return {
            reloadBalances: () => ZEC.reloadBalances(walletType),
            resetReloadBalances: () => ZEC.resetReloadBalances(walletType),
            balances$: ZEC.balances$({ walletType, walletAccount, walletIndex, hdMode }),
            reloadBalances$: ZEC.reloadBalances$
          }
        case XRPChain:
          return {
            reloadBalances: () => XRP.reloadBalances(walletType),
            resetReloadBalances: () => XRP.resetReloadBalances(walletType),
            balances$: XRP.balances$({ walletType, walletAccount, walletIndex, walletBalanceType, hdMode }),
            reloadBalances$: XRP.reloadBalances$
          }
        default:
          return {
            reloadBalances: FP.constVoid,
            resetReloadBalances: FP.constVoid,
            balances$: Rx.EMPTY,
            reloadBalances$: Rx.EMPTY
          }
      }
    } else {
      return {
        reloadBalances: FP.constVoid,
        resetReloadBalances: FP.constVoid,
        balances$: Rx.EMPTY,
        reloadBalances$: Rx.EMPTY
      }
    }
  }

  /**
   * Store previously successfully loaded results at the runtime-memory
   * to give to the user last balances he loaded without re-requesting
   * balances data which might be very expensive.
   */
  const walletBalancesState: Map<
    { chain: Chain; walletType: WalletType; walletBalanceType: WalletBalanceType },
    WalletBalancesRD
  > = new Map()

  // Whenever network is changed, reset stored balances
  const networkSub = network$.subscribe(() => {
    walletBalancesState.clear()
  })

  // Whenever keystore has been removed, reset stored balances
  const keystoreSub = keystore$.subscribe((keystoreState: KeystoreState) => {
    if (!hasImportedKeystore(keystoreState)) {
      walletBalancesState.clear()
    }
  })

  const getChainBalance$ = ({
    chain,
    walletType,
    walletAccount,
    walletIndex,
    hdMode,
    walletBalanceType
  }: {
    chain: Chain
    walletType: WalletType
    walletAccount: number
    walletIndex: number
    hdMode: HDMode
    walletBalanceType: WalletBalanceType
  }): WalletBalancesLD => {
    const chainService = getBalancesServiceByChain({
      chain,
      walletType,
      walletAccount,
      walletIndex,
      hdMode,
      walletBalanceType
    })
    const reload$ = FP.pipe(
      chainService.reloadBalances$,
      RxOp.finalize(() => {
        // on finish a stream reset reload-trigger
        // unsubscribe will be initiated on any View unmount
        chainService.resetReloadBalances()
      })
    )

    return FP.pipe(
      reload$,
      RxOp.switchMap((shouldReloadData) => {
        const savedResult = walletBalancesState.get({ chain, walletType, walletBalanceType })
        // For every new simple subscription return cached results if they exist
        if (!shouldReloadData && savedResult) {
          return Rx.of(savedResult)
        }

        // If there is no cached data for appropriate chain request for it
        // Re-request data ONLY for manual calling update trigger with `trigger`
        // value inside of trigger$ stream
        return FP.pipe(
          chainService.balances$,
          // For every successful load save results to the memory-based cache
          // to avoid unwanted data re-requesting.
          liveData.map((balances) => {
            walletBalancesState.set({ chain, walletType, walletBalanceType }, RD.success(balances))
            return balances
          }),
          RxOp.startWith(savedResult || RD.initial)
        )
      })
    )
  }

  /**
   * Factory to create a chain balance observable that uses dynamic wallet type from addressUI$
   */
  const createChainBalance$ = ({
    chain,
    addressUI$,
    walletBalanceType
  }: {
    chain: Chain
    addressUI$: Rx.Observable<O.Option<WalletAddress>>
    walletBalanceType: WalletBalanceType
  }): ChainBalance$ =>
    addressUI$.pipe(
      RxOp.switchMap((oWalletAddress) =>
        FP.pipe(
          oWalletAddress,
          O.fold(
            () =>
              Rx.of({
                walletType: WalletType.Keystore,
                chain,
                walletAddress: O.none,
                walletAccount: 0,
                walletIndex: 0,
                balances: RD.initial,
                balancesType: walletBalanceType
              }),
            (walletAddress) =>
              getChainBalance$({
                chain,
                walletType: walletAddress.type,
                walletAccount: walletAddress.walletAccount,
                walletIndex: walletAddress.walletIndex,
                hdMode: walletAddress.hdMode,
                walletBalanceType
              }).pipe(
                RxOp.map((balances) => ({
                  walletType: walletAddress.type,
                  chain,
                  walletAddress: O.some(walletAddress.address),
                  walletAccount: walletAddress.walletAccount,
                  walletIndex: walletAddress.walletIndex,
                  balances,
                  balancesType: walletBalanceType
                }))
              )
          )
        )
      )
    )

  /**
   * Transforms THOR balances into `ChainBalances`
   */
  const thorChainBalance$: ChainBalance$ = createChainBalance$({
    chain: THORChain,
    addressUI$: THOR.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Transforms SOL balances into `ChainBalances`
   */
  const solChainBalance$: ChainBalance$ = createChainBalance$({
    chain: SOLChain,
    addressUI$: SOL.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Transforms MAYA balances into `ChainBalances`
   */
  const mayaChainBalance$: ChainBalance$ = createChainBalance$({
    chain: MAYAChain,
    addressUI$: MAYA.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Factory to create a stream of ledger balances by given chain
   */
  const ledgerChainBalance$ = ({
    chain,
    walletBalanceType,
    getBalanceByAddress$
  }: {
    chain: Chain
    walletBalanceType: WalletBalanceType
    getBalanceByAddress$: ({
      address,
      walletAccount,
      walletType,
      walletIndex,
      hdMode,
      walletBalanceType
    }: {
      address: Address
      walletType: WalletType
      walletAccount: number
      walletIndex: number
      hdMode: HDMode
      walletBalanceType: WalletBalanceType
    }) => WalletBalancesLD
  }): ChainBalance$ =>
    FP.pipe(
      getLedgerAddress$(chain),
      RxOp.switchMap((oAddress) =>
        FP.pipe(
          oAddress,
          O.fold(
            () =>
              // In case we don't get an address,
              // just return `ChainBalance` w/ initial (empty) balances
              Rx.of<ChainBalance>({
                walletType: WalletType.Ledger,
                chain,
                walletAddress: O.none,
                balances: RD.initial,
                balancesType: walletBalanceType
              }),
            ({ address, walletAccount, walletIndex, hdMode }) =>
              // Load balances by given Ledger address
              // and put it's RD state into `balances` of `ChainBalance`
              FP.pipe(
                getBalanceByAddress$({
                  address,
                  walletType: WalletType.Ledger,
                  walletAccount,
                  walletIndex,
                  walletBalanceType,
                  hdMode
                }),
                RxOp.map<WalletBalancesRD, ChainBalance>((balances) => ({
                  walletType: WalletType.Ledger,
                  chain,
                  walletAddress: O.some(address),
                  balances,
                  balancesType: walletBalanceType,
                  hdMode
                }))
              )
          )
        )
      )
    )

  /**
   * THOR Ledger balances
   */
  const thorLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: THORChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: THOR.getBalanceByAddress$
  })

  /**
   * MAYA Ledger balances
   */
  const mayaLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: MAYAChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: MAYA.getBalanceByAddress$
  })

  /**
   * Transforms LTC balances into `ChainBalances`
   */
  const ltcBalance$: ChainBalance$ = createChainBalance$({
    chain: LTCChain,
    addressUI$: LTC.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Transforms Dash balances into `ChainBalances`
   */
  const dashBalance$: ChainBalance$ = createChainBalance$({
    chain: DASHChain,
    addressUI$: DASH.addressUI$,
    walletBalanceType: 'all'
  })
  /**
   * DASH Ledger balances
   */
  const dashLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: DASHChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: DASH.getBalanceByAddress$
  })

  /**
   * LTC Ledger balances
   */
  const ltcLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: LTCChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: LTC.getBalanceByAddress$
  })

  /**
   * Transforms BCH balances into `ChainBalances`
   */
  const bchChainBalance$: ChainBalance$ = createChainBalance$({
    chain: BCHChain,
    addressUI$: BCH.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * BCH Ledger balances
   */
  const bchLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: BCHChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: BCH.getBalanceByAddress$
  })

  /**
   * BTC Ledger balances
   */
  const btcLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: BTCChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: BTC.getBalanceByAddress$('all')
  })
  /**
   * BTC Ledger confirmed balances
   */
  const btcLedgerChainBalanceConfirmed$: ChainBalance$ = ledgerChainBalance$({
    chain: BTCChain,
    walletBalanceType: 'confirmed',
    getBalanceByAddress$: BTC.getBalanceByAddress$('confirmed')
  })

  /**
   * Transforms BTC balances into `ChainBalance`
   */
  const btcChainBalance$: ChainBalance$ = createChainBalance$({
    chain: BTCChain,
    addressUI$: BTC.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Transforms BTC confirmed balances into `ChainBalance`
   */
  const btcChainBalanceConfirmed$: ChainBalance$ = createChainBalance$({
    chain: BTCChain,
    addressUI$: BTC.addressUI$,
    walletBalanceType: 'confirmed'
  })

  /**
   * Transforms DOGE balances into `ChainBalance`
   */
  const dogeChainBalance$: ChainBalance$ = createChainBalance$({
    chain: DOGEChain,
    addressUI$: DOGE.addressUI$,
    walletBalanceType: 'all'
  })
  /**
   * Transforms KUJI balances into `ChainBalance`
   */
  const kujiChainBalance$: ChainBalance$ = createChainBalance$({
    chain: KUJIChain,
    addressUI$: KUJI.addressUI$,
    walletBalanceType: 'all'
  })
  /**
   * KUJI Ledger balances
   */
  const kujiLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: KUJIChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: KUJI.getBalanceByAddress$
  })

  /**
   * Transforms ADA balances into `ChainBalance`
   */
  const adaChainBalance$: ChainBalance$ = createChainBalance$({
    chain: ADAChain,
    addressUI$: ADA.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * ADA Ledger balances
   */
  const adaLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: ADAChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: ADA.getBalanceByAddress$
  })

  /**
   * DOGE Ledger balances
   */
  const dogeLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: DOGEChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: DOGE.getBalanceByAddress$
  })

  /**
   * Transforms ETH data (address + `WalletBalance`) into `ChainBalance`
   */
  const ethChainBalance$: ChainBalance$ = createChainBalance$({
    chain: ETHChain,
    addressUI$: ETH.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Transforms ARB data (address + `WalletBalance`) into `ChainBalance`
   */
  const arbChainBalance$: ChainBalance$ = createChainBalance$({
    chain: ARBChain,
    addressUI$: ARB.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Transforms AVAX data (address + `WalletBalance`) into `ChainBalance`
   */
  const avaxChainBalance$: ChainBalance$ = createChainBalance$({
    chain: AVAXChain,
    addressUI$: AVAX.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Transforms BASE data (address + `WalletBalance`) into `ChainBalance`
   */
  const baseChainBalance$: ChainBalance$ = createChainBalance$({
    chain: BASEChain,
    addressUI$: BASE.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Transforms BSC data (address + `WalletBalance`) into `ChainBalance`
   */
  const bscChainBalance$: ChainBalance$ = createChainBalance$({
    chain: BSCChain,
    addressUI$: BSC.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Transforms COSMOS balances into `ChainBalance`
   */
  const cosmosChainBalance$: ChainBalance$ = createChainBalance$({
    chain: GAIAChain,
    addressUI$: COSMOS.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Transforms Radix balances into `ChainBalance`
   */
  const xrdChainBalance$: ChainBalance$ = createChainBalance$({
    chain: RadixChain,
    addressUI$: XRD.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * Cosmos Ledger balances
   */
  const cosmosLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: GAIAChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: COSMOS.getBalanceByAddress$
  })

  /**
   * Radix Ledger balances
   */
  const xrdLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: RadixChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: XRD.getBalanceByAddress$
  })

  /**
   * SOL Ledger balances
   */
  const solLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: SOLChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: SOL.getBalanceByAddress$
  })

  /**
   * Transforms TRON balances into `ChainBalance`
   */
  const tronChainBalance$: ChainBalance$ = createChainBalance$({
    chain: TRONChain,
    addressUI$: TRON.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * TRON Ledger balances
   */
  const tronLedgerChainBalance$: ChainBalance$ = FP.pipe(
    network$,
    RxOp.switchMap((network) =>
      ledgerChainBalance$({
        chain: TRONChain,
        walletBalanceType: 'all',
        getBalanceByAddress$: TRON.getBalanceByAddress$(network)
      })
    )
  )

  /**
   * ETH Ledger balances
   */
  const ethLedgerChainBalance$: ChainBalance$ = FP.pipe(
    network$,
    RxOp.switchMap((network) =>
      ledgerChainBalance$({
        chain: ETHChain,
        walletBalanceType: 'all',
        getBalanceByAddress$: ETH.getBalanceByAddress$(network)
      })
    )
  )
  /**
   * ARB Ledger balances
   */
  const arbLedgerChainBalance$: ChainBalance$ = FP.pipe(
    network$,
    RxOp.switchMap((network) =>
      ledgerChainBalance$({
        chain: ARBChain,
        walletBalanceType: 'all',
        getBalanceByAddress$: ARB.getBalanceByAddress$(network)
      })
    )
  )
  /**
   * AVAX Ledger balances
   */
  const avaxLedgerChainBalance$: ChainBalance$ = FP.pipe(
    network$,
    RxOp.switchMap((network) =>
      ledgerChainBalance$({
        chain: AVAXChain,
        walletBalanceType: 'all',
        getBalanceByAddress$: AVAX.getBalanceByAddress$(network)
      })
    )
  )
  /**
   * BASE Ledger balances
   */
  const baseLedgerChainBalance$: ChainBalance$ = FP.pipe(
    network$,
    RxOp.switchMap((network) =>
      ledgerChainBalance$({
        chain: BASEChain,
        walletBalanceType: 'all',
        getBalanceByAddress$: BASE.getBalanceByAddress$(network)
      })
    )
  )
  /**
   * BSC Ledger balances
   */
  const bscLedgerChainBalance$: ChainBalance$ = FP.pipe(
    network$,
    RxOp.switchMap((network) =>
      ledgerChainBalance$({
        chain: BSCChain,
        walletBalanceType: 'all',
        getBalanceByAddress$: BSC.getBalanceByAddress$(network)
      })
    )
  )

  /**
   * Transforms ZEC balances into `ChainBalance`
   */
  const zecChainBalance$: ChainBalance$ = createChainBalance$({
    chain: ZECChain,
    addressUI$: ZEC.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * ZEC Ledger balances
   */
  const zecLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: ZECChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: ZEC.getBalanceByAddress$('all')
  })

  /**
   * Transforms XRP balances into `ChainBalance`
   */
  const xrpChainBalance$: ChainBalance$ = createChainBalance$({
    chain: XRPChain,
    addressUI$: XRP.addressUI$,
    walletBalanceType: 'all'
  })

  /**
   * XRP Ledger balances
   */
  const xrpLedgerChainBalance$: ChainBalance$ = ledgerChainBalance$({
    chain: XRPChain,
    walletBalanceType: 'all',
    getBalanceByAddress$: XRP.getBalanceByAddress$('all')
  })

  /**
   * List of `ChainBalances` for all available chains (order is important)
   *
   * It includes keystore + Ledger balances
   * For BTC only: Plus `confirmed` balances
   */
  const chainBalanceObservables: Record<Chain, ChainBalance$[]> = {
    THOR: [thorChainBalance$, thorLedgerChainBalance$],
    MAYA: [mayaChainBalance$, mayaLedgerChainBalance$],
    BTC: [btcChainBalance$, btcChainBalanceConfirmed$, btcLedgerChainBalance$, btcLedgerChainBalanceConfirmed$],
    BCH: [bchChainBalance$, bchLedgerChainBalance$],
    DASH: [dashBalance$, dashLedgerChainBalance$],
    ETH: [ethChainBalance$, ethLedgerChainBalance$],
    ARB: [arbChainBalance$, arbLedgerChainBalance$],
    AVAX: [avaxChainBalance$, avaxLedgerChainBalance$],
    BSC: [bscChainBalance$, bscLedgerChainBalance$],
    LTC: [ltcBalance$, ltcLedgerChainBalance$],
    DOGE: [dogeChainBalance$, dogeLedgerChainBalance$],
    GAIA: [cosmosChainBalance$, cosmosLedgerChainBalance$],
    KUJI: [kujiChainBalance$, kujiLedgerChainBalance$],
    ADA: [adaChainBalance$, adaLedgerChainBalance$],
    XRD: [xrdChainBalance$, xrdLedgerChainBalance$],
    SOL: [solChainBalance$, solLedgerChainBalance$],
    TRON: [tronChainBalance$, tronLedgerChainBalance$],
    BASE: [baseChainBalance$, baseLedgerChainBalance$],
    ZEC: [zecChainBalance$, zecLedgerChainBalance$],
    XRP: [xrpChainBalance$, xrpLedgerChainBalance$]
  }

  // Create ledger balance observables for filtering in standalone mode

  const ledgerBalanceObservables: Record<Chain, ChainBalance$[]> = {
    THOR: [thorLedgerChainBalance$],
    MAYA: [mayaLedgerChainBalance$],
    BTC: [btcLedgerChainBalance$, btcLedgerChainBalanceConfirmed$],
    BCH: [bchLedgerChainBalance$],
    DASH: [dashLedgerChainBalance$],
    ETH: [ethLedgerChainBalance$],
    ARB: [arbLedgerChainBalance$],
    AVAX: [avaxLedgerChainBalance$],
    BSC: [bscLedgerChainBalance$],
    LTC: [ltcLedgerChainBalance$],
    DOGE: [dogeLedgerChainBalance$],
    GAIA: [cosmosLedgerChainBalance$],
    KUJI: [kujiLedgerChainBalance$],
    ADA: [adaLedgerChainBalance$],
    XRD: [xrdLedgerChainBalance$],
    SOL: [solLedgerChainBalance$],
    TRON: [tronLedgerChainBalance$],
    BASE: [baseLedgerChainBalance$],
    ZEC: [zecLedgerChainBalance$],
    XRP: [xrpLedgerChainBalance$]
  }

  // Combine enabled chains with their corresponding balance observables
  // Filter based on wallet mode - in standalone ledger mode, only show ledger balances
  const chainBalances$: ChainBalances$ = FP.pipe(
    Rx.combineLatest([userChains$, appWalletService.appWalletState$]),
    RxOp.switchMap(([enabledChains, appWalletState]) => {
      const isStandaloneMode = appWalletState && isStandaloneLedgerMode(appWalletState)
      // Convert to Set for O(1) lookups
      const enabledChainsSet = new Set(enabledChains)

      let observablesToUse: Record<Chain, ChainBalance$[]>

      if (isStandaloneMode) {
        // In standalone ledger mode, only show balances for the connected chain
        const standaloneLedgerState = appWalletState as StandaloneLedgerState
        const connectedChain = standaloneLedgerState.connectedChain

        // Only use observables for the connected chain
        observablesToUse =
          connectedChain && ledgerBalanceObservables[connectedChain]
            ? { [connectedChain]: ledgerBalanceObservables[connectedChain] }
            : {}
      } else {
        // In normal mode, show all balances (keystore + ledger)
        observablesToUse = chainBalanceObservables
      }

      const enabledChainObservables: ChainBalance$[] = Object.entries(observablesToUse)
        .filter(([chain]) => enabledChainsSet.has(chain))
        .flatMap(([, observables]) => observables)

      return enabledChainObservables.length > 0 ? Rx.combineLatest(enabledChainObservables) : Rx.of([])
    }),
    // Filter out initial states
    RxOp.map((chainBalances) => chainBalances.filter(({ balances }) => !RD.isInitial(balances))),
    RxOp.shareReplay(1)
  )

  /**
   * Transform a list of BalancesLD
   * into a "single" state of `BalancesState`
   * to provide loading / error / data states of nested `balances` in a single "state" object
   *
   * @param {BalancesStateFilter} filter Options to filter balances by `walletBalancesType`
   *
   * Note: Empty list of balances won't be included in `BalancesState`
   */
  const balancesState$: BalancesState$ = (filter) =>
    FP.pipe(
      Rx.combineLatest([chainBalances$, userChains$]),
      RxOp.map(([chainBalances, userChains]) => ({
        balances: FP.pipe(
          chainBalances,
          // Filter by userChains and the given filter
          A.filter(({ balancesType, chain }) => {
            if (!userChains.includes(chain)) return false
            if (isSupportedChain(chain) && filter[chain]) return balancesType === filter[chain]
            return true
          }),
          // filter results out
          // Transformation: RD<ApiError, WalletBalances>[]`-> `WalletBalances[]`
          A.filterMap(({ balances }) => RD.toOption(balances)),
          A.flatten,
          NEA.fromArray
        ),

        loading: FP.pipe(
          chainBalances,
          // get list of balances
          A.map(({ balances }) => balances),
          A.elem(eqBalancesRD)(RD.pending)
        ),
        errors: FP.pipe(
          chainBalances,
          // get list of balances
          A.map(({ balances }) => balances),
          // filter errors out
          A.filter(RD.isFailure),
          // Transformation to get Errors out of RD:
          // `RemoteData<Error, never>[]` -> `RemoteData<never, Error>[]` -> `O.some(Error)[]`
          A.map(FP.flow(RD.recover(O.some), RD.toOption)),
          // Transformation: `O.some(Error)[]` -> `O.some(Error[])`
          sequenceTOptionFromArray,
          O.chain(NEA.fromArray)
        )
      })),
      RxOp.startWith(INITIAL_BALANCES_STATE)
    )

  /**
   * Dispose references / subscriptions (if needed)
   */
  const dispose = () => {
    networkSub.unsubscribe()
    keystoreSub.unsubscribe()
    walletBalancesState.clear()
  }

  return {
    reloadBalances,
    reloadBalancesByChain,
    chainBalances$,
    balancesState$,
    dispose
  }
}
