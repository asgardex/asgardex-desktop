import React, { useCallback, useEffect, useState } from 'react'
import { ArrowPathIcon, CpuChipIcon } from '@heroicons/react/24/outline'
import { Chain } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'
import { Navigate } from 'react-router-dom'

import { BaseButton } from '../../components/uielements/button'
import { Headline } from '../../components/uielements/headline'
import { useWalletContext } from '../../contexts/WalletContext'
import * as walletRoutes from '../../routes/wallet'
import { isStandaloneLedgerMode, StandaloneLedgerState } from '../../services/wallet/types'

// Alert component using Tailwind classes
const Alert: React.FC<{ type: 'success' | 'warning' | 'error'; children: React.ReactNode }> = ({ type, children }) => {
  const typeClasses = {
    success: 'bg-turquoise/20 border-turquoise text-turquoise',
    warning:
      'bg-warning0/20 border-warning0 text-warning0 dark:bg-warning0d/20 dark:border-warning0d dark:text-warning0d',
    error: 'bg-error0/20 border-error0 text-error0 dark:bg-error0d/20 dark:border-error0d dark:text-error0d'
  }

  return <div className={`p-4 rounded-lg my-4 border ${typeClasses[type]}`}>{children}</div>
}

const AlertTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="font-semibold mb-1">{children}</div>
)

const AlertDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-sm opacity-80">{children}</div>
)

export const StandaloneLedgerSwapView: React.FC = () => {
  const { appWalletService } = useWalletContext()

  const appWalletState = useObservableState(appWalletService.appWalletState$)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // All React hooks must be called before any conditional returns
  const handleRefreshDevices = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await appWalletService.standaloneLedgerService.detectLedgerDevices()
    } catch (error) {
      console.error('Error refreshing Ledger devices:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [appWalletService.standaloneLedgerService])

  const handleChainSelect = useCallback(
    async (chain: Chain, currentState: StandaloneLedgerState) => {
      try {
        const { connectedChain, address } = currentState
        if (connectedChain === chain) {
          // If already connected, disconnect
          appWalletService.standaloneLedgerService.setSelectedChain(undefined)
        } else {
          // Select and connect to this chain
          appWalletService.standaloneLedgerService.setSelectedChain(chain)

          // If not already connected, connect to this chain
          const isConnected = address && address.chain === chain
          if (!isConnected) {
            await appWalletService.standaloneLedgerService.connectLedgerChain(chain).pipe().toPromise()
          }
        }
      } catch (error) {
        console.error('Error selecting chain:', error)
      }
    },
    [appWalletService.standaloneLedgerService]
  )

  const handleExitLedgerMode = useCallback(() => {
    appWalletService.switchToKeystoreMode()
  }, [appWalletService])

  // Automatically detect ledger devices when component mounts
  useEffect(() => {
    const detectDevices = async () => {
      try {
        console.log('Auto-detecting ledger devices on mount...')
        const connectedChains = await appWalletService.standaloneLedgerService.detectLedgerDevices()
        console.log('Detection result:', connectedChains)
      } catch (error) {
        console.error('Error auto-detecting Ledger devices:', error)
      } finally {
        setIsInitialLoad(false)
      }
    }
    detectDevices()
  }, [appWalletService.standaloneLedgerService])

  // Redirect if not in standalone ledger mode
  if (!appWalletState || !isStandaloneLedgerMode(appWalletState)) {
    return <Navigate to={walletRoutes.base.path()} replace />
  }

  const { connectedChain } = appWalletState

  return (
    <div className="max-w-4xl mx-auto p-6 bg-bg0 dark:bg-bg0d min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <CpuChipIcon width={24} height={24} className="text-turquoise" />
          <Headline size="large" color="primary">
            Ledger Trading
          </Headline>
        </div>
        <BaseButton onClick={handleExitLedgerMode}>Switch to Keystore Mode</BaseButton>
      </div>

      {/* Status Card */}
      <div className="bg-bg1 dark:bg-bg1d border border-gray0 dark:border-gray0d rounded-xl p-5 mb-6">
        <h3 className="text-text1 dark:text-text1d text-lg font-semibold mb-4 m-0">Ledger Device Status</h3>

        {/* Device Status */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-3 h-3 rounded-full ${connectedChain ? 'bg-turquoise' : 'bg-error0 dark:bg-error0d'}`} />
          <span className="text-text2 dark:text-text2d">
            {isInitialLoad
              ? 'Detecting Ledger devices...'
              : connectedChain
              ? `Connected to ${connectedChain}`
              : 'No Ledger device detected'}
          </span>
          <BaseButton size="small" onClick={handleRefreshDevices} loading={isRefreshing}>
            <ArrowPathIcon width={16} height={16} style={{ marginRight: '4px' }} />
            Refresh
          </BaseButton>
        </div>

        {/* Connected Chain */}
        {connectedChain && (
          <>
            <div className="text-text2 dark:text-text2d mb-3">Connected chain:</div>
            <div className="flex flex-wrap gap-2 mb-4">
              <BaseButton
                size="small"
                className="bg-turquoise border-turquoise text-white"
                onClick={() => handleChainSelect(connectedChain, appWalletState)}>
                {connectedChain}
              </BaseButton>
            </div>
          </>
        )}

        {/* Connected Chain Alert */}
        {connectedChain && (
          <Alert type="success">
            <AlertTitle>Connected to: {connectedChain}</AlertTitle>
            <AlertDescription>Ready to trade on {connectedChain} network</AlertDescription>
          </Alert>
        )}
      </div>

      {/* No Device Alert */}
      {!connectedChain && !isInitialLoad && (
        <Alert type="warning">
          <AlertTitle>No Ledger Device Found</AlertTitle>
          <AlertDescription>
            Please connect your Ledger device and ensure it&apos;s unlocked with the appropriate app open.
          </AlertDescription>
        </Alert>
      )}

      {/* Swap Interface */}
      <div className="bg-bg1 dark:bg-bg1d border border-gray0 dark:border-gray0d rounded-xl p-6 text-center">
        <div className="text-text2 dark:text-text2d">
          <h3 className="text-xl font-semibold mb-4 text-text1 dark:text-text1d">Swap Interface Coming Soon</h3>
          <p className="mb-4 leading-relaxed">
            The standalone Ledger swap interface is under development. You can currently connect your Ledger device and
            select chains.
          </p>
          <p className="leading-relaxed">
            Once ready, you&apos;ll be able to swap assets directly using your Ledger without needing to set up a
            keystore wallet.
          </p>
        </div>
      </div>
    </div>
  )
}

export default StandaloneLedgerSwapView
