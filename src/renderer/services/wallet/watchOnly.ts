import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import { either as E } from 'fp-ts'
import * as Rx from 'rxjs'

import { observableState } from '../../helpers/stateHelper'
import { WatchOnlyState, WatchOnlyWallet } from './types'

/**
 * Service for managing watch-only wallets (public keys only)
 * Used on online computers for offline signing workflow
 */
export interface WatchOnlyWalletService {
  watchOnlyState$: Rx.Observable<WatchOnlyState | null>
  enterWatchOnlyMode: (wallets: WatchOnlyWallet[]) => void
  exitWatchOnlyMode: () => void
  addWatchWallet: (wallet: WatchOnlyWallet) => void
  removeWatchWallet: (address: string, chain: Chain) => void
  getWatchWallet: (address: string, chain: Chain) => WatchOnlyWallet | undefined
  exportWatchWallets: () => Promise<E.Either<Error, string>>
  importWatchWallets: () => Promise<E.Either<Error, WatchOnlyWallet[]>>
  clearWatchWallets: () => void
  exportKeystoreAsWatchOnly: (
    walletAccounts?: Array<{ chain: Chain; address: string }>
  ) => Promise<E.Either<Error, string>>
}

export const createWatchOnlyService = (): WatchOnlyWalletService => {
  const {
    get$: watchOnlyState$,
    get: watchOnlyState,
    set: setWatchOnlyState
  } = observableState<WatchOnlyState | null>(null)

  /**
   * Enter watch-only mode with imported wallets
   */
  const enterWatchOnlyMode = (wallets: WatchOnlyWallet[]): void => {
    setWatchOnlyState({
      mode: 'watch-only',
      wallets,
      setupComplete: true
    })
  }

  /**
   * Exit watch-only mode
   */
  const exitWatchOnlyMode = (): void => {
    setWatchOnlyState(null)
  }

  /**
   * Add a watch-only wallet
   */
  const addWatchWallet = (wallet: WatchOnlyWallet): void => {
    const currentState = watchOnlyState()
    if (!currentState) {
      // Initialize watch-only mode with this wallet
      enterWatchOnlyMode([wallet])
      return
    }

    // Check if wallet already exists
    const exists = currentState.wallets.some((w) => w.address === wallet.address && w.chain === wallet.chain)

    if (!exists) {
      setWatchOnlyState({
        ...currentState,
        wallets: [...currentState.wallets, wallet]
      })
    }
  }

  /**
   * Remove a watch-only wallet
   */
  const removeWatchWallet = (address: string, chain: Chain): void => {
    const currentState = watchOnlyState()
    if (!currentState) return

    const updatedWallets = currentState.wallets.filter((w) => !(w.address === address && w.chain === chain))

    if (updatedWallets.length === 0) {
      // No wallets left, exit watch-only mode
      exitWatchOnlyMode()
    } else {
      setWatchOnlyState({
        ...currentState,
        wallets: updatedWallets
      })
    }
  }

  /**
   * Get a specific watch wallet
   */
  const getWatchWallet = (address: string, chain: Chain): WatchOnlyWallet | undefined => {
    const currentState = watchOnlyState()
    if (!currentState) return undefined

    return currentState.wallets.find((w) => w.address === address && w.chain === chain)
  }

  /**
   * Export watch wallets to file
   */
  const exportWatchWallets = async (): Promise<E.Either<Error, string>> => {
    const currentState = watchOnlyState()
    if (!currentState || currentState.wallets.length === 0) {
      return E.left(new Error('No watch-only wallets to export'))
    }

    try {
      const result = await window.apiOfflineTransaction.exportWatchWallets(currentState.wallets)
      return result
    } catch (error) {
      return E.left(new Error(`Failed to export watch wallets: ${error}`))
    }
  }

  /**
   * Import watch wallets from file
   */
  const importWatchWallets = async (): Promise<E.Either<Error, WatchOnlyWallet[]>> => {
    try {
      const result = await window.apiOfflineTransaction.importWatchWallets()

      if (E.isRight(result)) {
        // Convert from shared type to local type
        const wallets: WatchOnlyWallet[] = result.right.map((w) => ({
          address: w.address,
          publicKey: w.publicKey,
          chain: w.chain,
          walletIndex: w.walletIndex,
          hdPath: w.hdPath
        }))

        enterWatchOnlyMode(wallets)
        return E.right(wallets)
      }

      return result as E.Either<Error, WatchOnlyWallet[]>
    } catch (error) {
      return E.left(new Error(`Failed to import watch wallets: ${error}`))
    }
  }

  /**
   * Clear all watch wallets and exit watch-only mode
   */
  const clearWatchWallets = (): void => {
    exitWatchOnlyMode()
  }

  /**
   * Export keystore addresses as watch-only wallets
   * This allows users to create a watch-only file from their current keystore wallet
   */
  const exportKeystoreAsWatchOnly = async (
    walletAccounts?: Array<{ chain: Chain; address: string }>
  ): Promise<E.Either<Error, string>> => {
    try {
      if (!walletAccounts || walletAccounts.length === 0) {
        return E.left(new Error('No wallet accounts provided to export'))
      }

      // Convert wallet accounts to watch-only format
      const watchWallets: WatchOnlyWallet[] = walletAccounts.map(({ chain, address }) => ({
        address,
        chain,
        walletIndex: 0,
        hdPath: getDefaultHDPath(chain, 0)
      }))

      // Export using the existing export function
      const result = await window.apiOfflineTransaction.exportWatchWallets(watchWallets)
      return result
    } catch (error) {
      return E.left(new Error(`Failed to export keystore as watch-only: ${error}`))
    }
  }

  return {
    watchOnlyState$,
    enterWatchOnlyMode,
    exitWatchOnlyMode,
    addWatchWallet,
    removeWatchWallet,
    getWatchWallet,
    exportWatchWallets,
    importWatchWallets,
    clearWatchWallets,
    exportKeystoreAsWatchOnly
  }
}

/**
 * Helper to create a watch wallet from an address
 */
export const createWatchWalletFromAddress = (
  address: string,
  chain: Chain,
  walletIndex: number = 0
): WatchOnlyWallet => ({
  address,
  chain,
  walletIndex,
  hdPath: getDefaultHDPath(chain, walletIndex)
})

/**
 * Get default HD path for a chain
 */
const getDefaultHDPath = (chain: Chain, index: number): string => {
  // Common HD paths - adjust as needed
  const paths: Record<string, string> = {
    [THORChain]: `m/44'/931'/0'/0/${index}`,
    BTC: `m/84'/0'/0'/0/${index}`, // Native SegWit
    ETH: `m/44'/60'/0'/0/${index}`,
    BNB: `m/44'/714'/0'/0/${index}`
    // Add more chains as needed
  }

  return paths[chain] || `m/44'/0'/0'/0/${index}`
}

// Global instance
export const watchOnlyService = createWatchOnlyService()
