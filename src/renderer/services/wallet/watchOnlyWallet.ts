import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import { either as E, function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WatchOnlyWallet, WalletMode } from '../../../shared/api/offlineTx'
import { observableState } from '../../helpers/stateHelper'

/**
 * Service for managing watch-only wallets (public keys only)
 * Used on online computers for offline signing workflow
 */
export interface WatchOnlyWalletService {
  walletMode$: Rx.Observable<WalletMode>
  setWalletMode: (mode: WalletMode) => void
  watchWallets$: Rx.Observable<WatchOnlyWallet[]>
  addWatchWallet: (wallet: WatchOnlyWallet) => void
  removeWatchWallet: (address: string, chain: Chain) => void
  exportWatchWallets: () => Promise<E.Either<Error, string>>
  importWatchWallets: () => Promise<E.Either<Error, WatchOnlyWallet[]>>
  getWatchWallet: (address: string, chain: Chain) => WatchOnlyWallet | undefined
  clearWatchWallets: () => void
}

export const createWatchOnlyWalletService = (): WatchOnlyWalletService => {
  // Wallet mode state
  const { get$: walletMode$, set: setWalletMode } = observableState<WalletMode>(WalletMode.NORMAL)

  // Watch-only wallets state
  const { get$: watchWallets$, set: setWatchWallets } = observableState<WatchOnlyWallet[]>([])

  /**
   * Add a watch-only wallet
   */
  const addWatchWallet = (wallet: WatchOnlyWallet): void => {
    watchWallets$.pipe(RxOp.take(1)).subscribe((currentWallets) => {
      // Check if wallet already exists
      const exists = currentWallets.some((w) => w.address === wallet.address && w.chain === wallet.chain)

      if (!exists) {
        setWatchWallets([...currentWallets, wallet])
      }
    })
  }

  /**
   * Remove a watch-only wallet
   */
  const removeWatchWallet = (address: string, chain: Chain): void => {
    watchWallets$.pipe(RxOp.take(1)).subscribe((currentWallets) => {
      setWatchWallets(currentWallets.filter((w) => !(w.address === address && w.chain === chain)))
    })
  }

  /**
   * Get a specific watch wallet
   */
  const getWatchWallet = (address: string, chain: Chain): WatchOnlyWallet | undefined => {
    let wallet: WatchOnlyWallet | undefined
    watchWallets$.pipe(RxOp.take(1)).subscribe((wallets) => {
      wallet = wallets.find((w) => w.address === address && w.chain === chain)
    })
    return wallet
  }

  /**
   * Export watch wallets to file
   */
  const exportWatchWallets = async (): Promise<E.Either<Error, string>> => {
    try {
      let wallets: WatchOnlyWallet[] = []
      watchWallets$.pipe(RxOp.take(1)).subscribe((w) => (wallets = w))

      if (wallets.length === 0) {
        return E.left(new Error('No watch-only wallets to export'))
      }

      // Use the file API to export
      const result = await window.apiOfflineTransaction.exportWatchWallets(wallets)
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
        setWatchWallets(result.right)
        setWalletMode(WalletMode.ONLINE_WATCH_ONLY)
      }

      return result
    } catch (error) {
      return E.left(new Error(`Failed to import watch wallets: ${error}`))
    }
  }

  /**
   * Clear all watch wallets
   */
  const clearWatchWallets = (): void => {
    setWatchWallets([])
    setWalletMode(WalletMode.NORMAL)
  }

  return {
    walletMode$,
    setWalletMode,
    watchWallets$,
    addWatchWallet,
    removeWatchWallet,
    exportWatchWallets,
    importWatchWallets,
    getWatchWallet,
    clearWatchWallets
  }
}

// Global instance
export const watchOnlyWalletService = createWatchOnlyWalletService()

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
