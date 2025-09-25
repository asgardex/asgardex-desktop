import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { LedgerErrorId } from '../../../shared/api/types'
import { DEFAULT_EVM_HD_MODE } from '../../../shared/evm/types'
import { isError } from '../../../shared/utils/guard'
import { HDMode, WalletAddress, WalletType } from '../../../shared/wallet/types'
import { isEvmChain } from '../../helpers/evmHelper'
import { liveData } from '../../helpers/rx/liveData'
import { observableState } from '../../helpers/stateHelper'
import { Network$ } from '../app/types'
import {
  StandaloneLedgerService,
  StandaloneLedgerState,
  ConnectLedgerChainHandler,
  DisconnectLedgerChainHandler,
  DetectLedgerDevicesHandler
} from './types'

const supportedChains: Chain[] = [
  'BTC',
  'ETH',
  'THOR',
  'LTC',
  'BCH',
  'DASH',
  'DOGE',
  'GAIA',
  'AVAX',
  'BSC',
  'ARB',
  'BASE',
  'TRON'
]

const INITIAL_STANDALONE_LEDGER_STATE: StandaloneLedgerState = {
  mode: 'standalone-ledger',
  detectionPhase: 'chain-selection',
  availableChains: supportedChains,
  selectedChainForDetection: undefined,
  connectedChain: undefined,
  address: undefined,
  selectedHDMode: undefined,
  selectedWalletAccount: 0,
  selectedWalletIndex: 0
}

/**
 * Get the correct HD mode for a specific chain
 */
const getHDModeForChain = (chain: Chain): HDMode => {
  // EVM chains need EVM HD mode
  if (isEvmChain(chain)) {
    return DEFAULT_EVM_HD_MODE
  }
  // All other chains use default HD mode
  return 'default'
}

export const createStandaloneLedgerService = ({ network$ }: { network$: Network$ }): StandaloneLedgerService => {
  // Internal state management
  const {
    get$: standaloneLedgerState$,
    get: standaloneLedgerState,
    set: setStandaloneLedgerState
  } = observableState<StandaloneLedgerState>(INITIAL_STANDALONE_LEDGER_STATE)

  /**
   * Detects if the selected chain is connected to a Ledger device
   * Retries with delays to give user time to open the correct app
   */
  const detectLedgerDevices: DetectLedgerDevicesHandler = async () => {
    const currentState = standaloneLedgerState()

    // Only detect the single chain that user has selected
    const chainToDetect = currentState.selectedChainForDetection

    if (!chainToDetect) {
      console.warn('No chain selected for detection')
      return undefined
    }

    // Update state to detecting phase
    setStandaloneLedgerState({
      ...currentState,
      detectionPhase: 'detecting',
      detectionProgress: {
        currentChain: chainToDetect
      }
    })

    const currentNetwork = await network$.pipe(RxOp.take(1)).toPromise()
    const maxRetries = 30 // 30 attempts = ~30 seconds with 1 second intervals
    let retryCount = 0

    const attemptDetection = async (): Promise<Chain | undefined> => {
      try {
        // Get detection parameters from state
        const detectionState = standaloneLedgerState()
        const hdMode = detectionState.selectedHDMode || getHDModeForChain(chainToDetect)
        const walletAccount = detectionState.selectedWalletAccount || 0
        const walletIndex = detectionState.selectedWalletIndex || 0

        // Attempt to get address - if successful, device is connected for this chain
        const result = await window.apiHDWallet.getLedgerAddress({
          chain: chainToDetect,
          network: currentNetwork || 'mainnet',
          walletAccount,
          walletIndex,
          hdMode
        })

        if (result && !('left' in result)) {
          // Create wallet address for the connected chain
          const walletAddress = {
            address: result.right.address,
            chain: chainToDetect,
            walletAccount: result.right.walletAccount,
            walletIndex: result.right.walletIndex,
            hdMode: result.right.hdMode,
            type: WalletType.Ledger as const
          }

          // Update state with success
          setStandaloneLedgerState({
            ...standaloneLedgerState(),
            detectionPhase: 'completed',
            connectedChain: chainToDetect,
            address: walletAddress,
            detectionProgress: undefined
          })

          return chainToDetect
        }
      } catch (error) {
        // Continue retrying unless we've exceeded max retries
      }

      retryCount++

      // If we haven't exceeded retries, wait and try again
      if (retryCount < maxRetries) {
        // Check if detection is still in progress (user hasn't navigated away)
        const state = standaloneLedgerState()
        if (state.detectionPhase === 'detecting') {
          await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second
          return attemptDetection()
        }
      }

      // All attempts failed or detection was cancelled
      return undefined
    }

    const result = await attemptDetection()

    if (!result) {
      // Update state with failure only if still in detecting phase
      const state = standaloneLedgerState()
      if (state.detectionPhase === 'detecting') {
        setStandaloneLedgerState({
          ...state,
          detectionPhase: 'completed',
          connectedChain: undefined,
          address: undefined,
          detectionProgress: undefined
        })
      }
    }

    return result
  }

  /**
   * Connects to a specific chain on the Ledger device
   */
  const connectLedgerChain: ConnectLedgerChainHandler = (
    chain: Chain,
    hdMode: HDMode = getHDModeForChain(chain),
    walletAccount: number = 0,
    walletIndex: number = 0
  ) =>
    FP.pipe(
      Rx.combineLatest([network$, Rx.of(chain)]),
      RxOp.take(1),
      RxOp.switchMap(([network, selectedChain]) =>
        FP.pipe(
          Rx.from(
            window.apiHDWallet.getLedgerAddress({
              chain: selectedChain,
              network,
              walletAccount,
              walletIndex,
              hdMode
            })
          ),
          RxOp.map(RD.fromEither),
          RxOp.catchError((error) =>
            Rx.of(
              RD.failure({
                errorId: LedgerErrorId.GET_ADDRESS_FAILED,
                msg: isError(error) ? error?.message ?? error.toString() : `${error}`
              })
            )
          ),
          liveData.map<WalletAddress, WalletAddress>((walletAddress) => {
            const currentState = standaloneLedgerState()

            // Create the ledger address with WalletType.Ledger
            const ledgerAddress: WalletAddress = {
              ...walletAddress,
              type: WalletType.Ledger,
              chain: selectedChain
            }

            // Update state: add chain to connected list and store address
            const updatedState: StandaloneLedgerState = {
              ...currentState,
              connectedChain: selectedChain,
              address: ledgerAddress
            }

            setStandaloneLedgerState(updatedState)

            // The addressUI$ function will now pick up this address via the modified logic
            // The balance system should automatically start fetching balances for this address

            return ledgerAddress
          })
        )
      ),
      RxOp.startWith(RD.pending)
    )

  /**
   * Gets address for a chain without updating the global state
   * Useful for fetching target addresses without affecting source balance
   */
  const getAddressWithoutStateChange = (
    chain: Chain,
    hdMode: HDMode = getHDModeForChain(chain),
    walletAccount: number = 0,
    walletIndex: number = 0
  ) =>
    FP.pipe(
      Rx.combineLatest([network$, Rx.of(chain)]),
      RxOp.take(1),
      RxOp.switchMap(([network, selectedChain]) =>
        FP.pipe(
          Rx.from(
            window.apiHDWallet.getLedgerAddress({
              chain: selectedChain,
              network,
              walletAccount,
              walletIndex,
              hdMode
            })
          ),
          RxOp.map(RD.fromEither),
          RxOp.catchError((error) =>
            Rx.of(
              RD.failure({
                errorId: LedgerErrorId.GET_ADDRESS_FAILED,
                msg: isError(error) ? error?.message ?? error.toString() : `${error}`
              })
            )
          ),
          liveData.map<WalletAddress, WalletAddress>((walletAddress) => {
            // Create the ledger address without updating global state
            const ledgerAddress: WalletAddress = {
              ...walletAddress,
              type: WalletType.Ledger,
              chain: selectedChain
            }

            return ledgerAddress
          })
        )
      ),
      RxOp.startWith(RD.pending)
    )

  /**
   * Disconnects the current chain from standalone ledger mode
   */
  const disconnectLedgerChain: DisconnectLedgerChainHandler = async (chain: Chain) => {
    const currentState = standaloneLedgerState()

    // Since we only support one chain, clear everything if it matches
    if (currentState.connectedChain === chain) {
      const updatedState: StandaloneLedgerState = {
        ...currentState,
        connectedChain: undefined,
        address: undefined
      }

      setStandaloneLedgerState(updatedState)
    }
  }

  /**
   * Sets the currently selected chain for operations
   */
  const setSelectedChain = (chain?: Chain) => {
    const currentState = standaloneLedgerState()
    setStandaloneLedgerState({
      ...currentState,
      connectedChain: chain
    })
  }

  /**
   * Updates the single chain selected for detection
   */
  const setSelectedChainForDetection = (chain?: Chain) => {
    const currentState = standaloneLedgerState()
    setStandaloneLedgerState({
      ...currentState,
      selectedChainForDetection: chain
    })
  }

  /**
   * Starts the detection phase after user has selected a chain
   */
  const startDetection = async () => {
    const currentState = standaloneLedgerState()

    if (!currentState.selectedChainForDetection) {
      console.warn('Cannot start detection: no chain selected')
      return undefined
    }

    return await detectLedgerDevices()
  }

  /**
   * Resets to chain selection phase
   */
  const resetToChainSelection = () => {
    const currentState = standaloneLedgerState()
    setStandaloneLedgerState({
      ...currentState,
      detectionPhase: 'chain-selection',
      selectedChainForDetection: undefined,
      connectedChain: undefined,
      address: undefined,
      detectionProgress: undefined
    })
  }

  /**
   * Enters standalone ledger mode
   */
  const enterStandaloneMode = () => {
    setStandaloneLedgerState(INITIAL_STANDALONE_LEDGER_STATE)
  }

  /**
   * Exits standalone ledger mode and clears all data
   */
  const exitStandaloneMode = () => {
    setStandaloneLedgerState(INITIAL_STANDALONE_LEDGER_STATE)
  }

  /**
   * Sets the HD mode for detection
   */
  const setDetectionHDMode = (hdMode: HDMode) => {
    const currentState = standaloneLedgerState()
    setStandaloneLedgerState({
      ...currentState,
      selectedHDMode: hdMode
    })
  }

  /**
   * Sets wallet account and index for detection
   */
  const setDetectionWalletParams = (walletAccount: number, walletIndex: number) => {
    const currentState = standaloneLedgerState()
    setStandaloneLedgerState({
      ...currentState,
      selectedWalletAccount: walletAccount,
      selectedWalletIndex: walletIndex
    })
  }

  return {
    standaloneLedgerState$,
    connectLedgerChain,
    getAddressWithoutStateChange,
    disconnectLedgerChain,
    detectLedgerDevices,
    setSelectedChain,
    setSelectedChainForDetection,
    startDetection,
    resetToChainSelection,
    enterStandaloneMode,
    exitStandaloneMode,
    setDetectionHDMode,
    setDetectionWalletParams
  }
}
