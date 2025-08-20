import React, { useCallback, useEffect } from 'react'
import { Chain } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { WalletType } from '../../../shared/wallet/types'
import { ChainSelector } from '../../components/wallet/ChainSelector'
import { useWalletContext } from '../../contexts/WalletContext'
import * as walletRoutes from '../../routes/wallet'
import { isStandaloneLedgerMode } from '../../services/wallet/types'

export const LedgerChainSelectView: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { appWalletService, reloadBalancesByChain, reloadBalances } = useWalletContext()

  // Get current app wallet state and standalone ledger state
  const appWalletState = useObservableState(appWalletService.appWalletState$)
  const standaloneLedgerState = useObservableState(appWalletService.standaloneLedgerService.standaloneLedgerState$)

  // Check if we're coming from "Change Chain" button
  const isChangingChain = searchParams.get('changeChain') === 'true'

  // Initialize standalone ledger mode when mounting
  useEffect(() => {
    // Only switch to standalone ledger mode if not already in it
    if (!appWalletState || !isStandaloneLedgerMode(appWalletState)) {
      appWalletService.switchToStandaloneLedgerMode()
    }
  }, [appWalletService, appWalletState])

  const handleBackToNoWallet = useCallback(() => {
    // Reset standalone ledger service and go back to no wallet view
    appWalletService.standaloneLedgerService.resetToChainSelection()
    appWalletService.switchToKeystoreMode() // Switch back to initial state
    navigate(walletRoutes.noWallet.path())
  }, [appWalletService, navigate])

  const handleChainSelectionChange = useCallback(
    (chain?: Chain) => {
      appWalletService.standaloneLedgerService.setSelectedChainForDetection(chain)
    },
    [appWalletService.standaloneLedgerService]
  )

  const handleStartDetection = useCallback(async () => {
    try {
      console.log('Starting Ledger detection for selected chains...')
      await appWalletService.standaloneLedgerService.startDetection()
    } catch (error) {
      console.error('Error during Ledger detection:', error)
    }
  }, [appWalletService.standaloneLedgerService])

  const handleDetectSingle = useCallback(
    async (chain: Chain) => {
      try {
        console.log(`Starting single chain detection for: ${chain}`)
        // Set this single chain as selected and start detection
        appWalletService.standaloneLedgerService.setSelectedChainForDetection(chain)
        await appWalletService.standaloneLedgerService.startDetection()
      } catch (error) {
        console.error(`Error during single chain detection for ${chain}:`, error)
      }
    },
    [appWalletService.standaloneLedgerService]
  )

  const handleDetectionComplete = useCallback(async () => {
    try {
      const connectedChain = standaloneLedgerState?.connectedChain

      if (connectedChain) {
        appWalletService.standaloneLedgerService.setSelectedChain(connectedChain)

        // Trigger balance reload for the detected chain
        console.log(`Triggering balance reload for chain: ${connectedChain}`)
        reloadBalancesByChain(connectedChain, WalletType.Ledger)()

        // Also trigger a general balance reload to ensure all balances are refreshed
        reloadBalances()

        console.log('Balance reload triggered for connected chain')
      }

      // Navigate to assets page without any URL parameters
      navigate(walletRoutes.assets.path(), { replace: true })
    } catch (error) {
      console.error('Error completing standalone ledger setup:', error)
    }
  }, [appWalletService, navigate, standaloneLedgerState?.connectedChain, reloadBalancesByChain, reloadBalances])

  // If user is already in standalone ledger mode and has completed detection, redirect to wallet
  // UNLESS they're changing chains
  if (
    appWalletState &&
    isStandaloneLedgerMode(appWalletState) &&
    standaloneLedgerState?.detectionPhase === 'completed' &&
    standaloneLedgerState?.connectedChain &&
    !isChangingChain
  ) {
    return <Navigate to={walletRoutes.assets.path()} replace />
  }

  // Show chain selector (wait for state to be initialized)
  if (!standaloneLedgerState) {
    return null // Or a loading indicator
  }

  return (
    <ChainSelector
      availableChains={standaloneLedgerState.availableChains}
      selectedChain={standaloneLedgerState.selectedChainForDetection}
      onSelectionChange={handleChainSelectionChange}
      onStartDetection={handleStartDetection}
      onDetectSingle={handleDetectSingle}
      onBack={standaloneLedgerState.detectionPhase === 'completed' ? handleDetectionComplete : handleBackToNoWallet}
      isDetecting={standaloneLedgerState.detectionPhase === 'detecting'}
      detectionProgress={standaloneLedgerState.detectionProgress}
      connectedChain={standaloneLedgerState.connectedChain}
      detectionPhase={standaloneLedgerState.detectionPhase}
    />
  )
}

export default LedgerChainSelectView
