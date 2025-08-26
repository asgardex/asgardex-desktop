import React, { useCallback, useEffect, useState } from 'react'
import { Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { AssetIcon } from '../../components/uielements/assets/assetIcon'
import { FlatButton } from '../../components/uielements/button'
import { BackLinkButton } from '../../components/uielements/button/BackLinkButton'
import { Headline } from '../../components/uielements/headline'
import { Spin } from '../../components/uielements/spin'
import { useWalletContext } from '../../contexts/WalletContext'
import { getChainAsset } from '../../helpers/chainHelper'
import { useNetwork } from '../../hooks/useNetwork'
import * as walletRoutes from '../../routes/wallet'
import { isStandaloneLedgerMode } from '../../services/wallet/types'

// Check if chain supports HD modes
const chainSupportsHDModes = (chain: Chain): boolean => {
  return ['ETH', 'BSC', 'AVAX', 'ARB', 'BASE'].includes(chain)
}

interface ChainItemProps {
  chain: Chain
  isSelected: boolean
  onSelect: (chain: Chain) => void
}

const ChainItem: React.FC<ChainItemProps> = ({ chain, isSelected, onSelect }) => {
  const { network } = useNetwork()
  const handleClick = useCallback(() => {
    onSelect(chain)
  }, [chain, onSelect])

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'flex items-center gap-3 p-4 rounded-lg border transition-all cursor-pointer',
        'hover:border-turquoise hover:bg-gray0/10 dark:hover:bg-gray0d/10',
        isSelected
          ? 'border-turquoise bg-turquoise/10 dark:bg-turquoise/5'
          : 'border-gray0 dark:border-gray0d bg-bg1 dark:bg-bg1d'
      )}>
      <AssetIcon asset={getChainAsset(chain)} network={network} size="small" />
      <span className="text-text1 dark:text-text1d font-medium text-16">{chain}</span>
    </button>
  )
}

export const LedgerChainSelectView: React.FC = () => {
  const intl = useIntl()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { appWalletService, reloadBalancesByChain, reloadBalances } = useWalletContext()

  const [selectedChain, setSelectedChain] = useState<Chain | undefined>(undefined)
  const [selectedHDMode, setSelectedHDMode] = useState<HDMode>('default')

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

  const handleChainSelect = useCallback((chain: Chain) => {
    setSelectedChain(chain)
    // If chain doesn't support HD modes, reset to default
    if (!chainSupportsHDModes(chain)) {
      setSelectedHDMode('default')
    }
  }, [])

  const handleStartDetection = useCallback(async () => {
    if (!selectedChain) return

    try {
      // Set the selected chain and HD mode
      appWalletService.standaloneLedgerService.setSelectedChainForDetection(selectedChain)
      // TODO: Pass HD mode to the detection service when implemented

      await appWalletService.standaloneLedgerService.startDetection()
    } catch (error) {
      console.error('Error during single chain detection for chain:', selectedChain, error)
    }
  }, [selectedChain, appWalletService.standaloneLedgerService])

  const handleDetectionComplete = useCallback(async () => {
    try {
      const connectedChain = standaloneLedgerState?.connectedChain

      if (connectedChain) {
        appWalletService.standaloneLedgerService.setSelectedChain(connectedChain)

        // Trigger balance reload for the detected chain
        reloadBalancesByChain(connectedChain, WalletType.Ledger)()

        // Also trigger a general balance reload to ensure all balances are refreshed
        reloadBalances()
      }

      // Navigate to assets page without any URL parameters
      navigate(walletRoutes.assets.path(), { replace: true })
    } catch (error) {
      console.error('Error completing standalone ledger setup:', error)
    }
  }, [appWalletService, navigate, standaloneLedgerState?.connectedChain, reloadBalancesByChain, reloadBalances])

  // Auto-redirect immediately when detection is completed
  useEffect(() => {
    if (standaloneLedgerState?.detectionPhase === 'completed' && standaloneLedgerState?.connectedChain) {
      // Redirect immediately without timer
      handleDetectionComplete()
    }
  }, [standaloneLedgerState?.detectionPhase, standaloneLedgerState?.connectedChain, handleDetectionComplete])

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

  // Detection in progress state
  if (standaloneLedgerState.detectionPhase === 'detecting') {
    return (
      <div className="flex flex-col min-h-screen bg-bg0 dark:bg-bg0d">
        <div className="px-6 py-4">
          <BackLinkButton />
        </div>

        <div className="flex-1 px-6 pt-8">
          <div className="w-full max-w-2xl mx-auto">
            <Headline size="large" color="primary" className="mb-8 text-center">
              {intl.formatMessage({ id: 'ledger.detect.title' })}
            </Headline>

            <Spin
              className="min-h-24 border border-gray0 dark:border-gray0d rounded-lg mb-6"
              spinning={true}
              tip={
                standaloneLedgerState.detectionProgress?.currentChain
                  ? intl.formatMessage(
                      { id: 'ledger.detect.checking' },
                      { chain: standaloneLedgerState.detectionProgress.currentChain }
                    )
                  : intl.formatMessage({ id: 'common.loading' })
              }
            />

            <div className="text-center space-y-3">
              <p className="text-text2 dark:text-text2d text-14">
                {standaloneLedgerState.detectionProgress?.currentChain
                  ? intl.formatMessage(
                      { id: 'ledger.needsconnected' },
                      { chain: standaloneLedgerState.detectionProgress.currentChain }
                    )
                  : intl.formatMessage({ id: 'ledger.connect.instructions' })}
              </p>
              <p className="text-text2 dark:text-text2d text-12 opacity-75">
                Make sure to open the {standaloneLedgerState.detectionProgress?.currentChain || 'required'} app on your
                Ledger device
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Chain selection state
  return (
    <div className="flex flex-col min-h-screen bg-bg0 dark:bg-bg0d">
      <div className="px-6 py-4">
        <BackLinkButton />
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pb-6">
        <div className="w-full max-w-2xl">
          <Headline size="large" color="primary" className="mb-2 text-center">
            {intl.formatMessage({ id: 'ledger.connect.title' })}
          </Headline>

          <p className="text-center text-text2 dark:text-text2d text-16 mb-8">
            {intl.formatMessage({ id: 'ledger.connect.instruction' })}
          </p>

          {/* Chain grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
            {standaloneLedgerState.availableChains.map((chain) => (
              <ChainItem key={chain} chain={chain} isSelected={selectedChain === chain} onSelect={handleChainSelect} />
            ))}
          </div>

          {/* HD Mode selection for EVM chains */}
          {selectedChain && chainSupportsHDModes(selectedChain) && (
            <div className="bg-bg1 dark:bg-bg1d rounded-lg p-4 mb-8">
              <h3 className="text-text1 dark:text-text1d font-medium text-14 mb-3">
                {intl.formatMessage({ id: 'ledger.derivation.path' })}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedHDMode('ledgerlive')}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-14 transition-all',
                    selectedHDMode === 'ledgerlive'
                      ? 'bg-turquoise text-white'
                      : 'bg-gray0 dark:bg-gray0d text-text2 dark:text-text2d hover:bg-gray0/80'
                  )}>
                  {intl.formatMessage({ id: 'common.ledgerlive' })}
                </button>
                <button
                  onClick={() => setSelectedHDMode('legacy')}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-14 transition-all',
                    selectedHDMode === 'legacy'
                      ? 'bg-turquoise text-white'
                      : 'bg-gray0 dark:bg-gray0d text-text2 dark:text-text2d hover:bg-gray0/80'
                  )}>
                  {intl.formatMessage({ id: 'ledger.derivation.legacy' })}
                </button>
                <button
                  onClick={() => setSelectedHDMode('metamask')}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-14 transition-all',
                    selectedHDMode === 'metamask'
                      ? 'bg-turquoise text-white'
                      : 'bg-gray0 dark:bg-gray0d text-text2 dark:text-text2d hover:bg-gray0/80'
                  )}>
                  {intl.formatMessage({ id: 'ledger.derivation.metamask' })}
                </button>
              </div>
            </div>
          )}

          {/* Connect button */}
          <div className="flex justify-center">
            <FlatButton
              type="button"
              size="large"
              color="primary"
              onClick={handleStartDetection}
              disabled={!selectedChain}
              className="min-w-[200px]">
              {selectedChain
                ? intl.formatMessage({ id: 'ledger.connect.chain' }, { chain: selectedChain })
                : intl.formatMessage({ id: 'ledger.connect.select' })}
            </FlatButton>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LedgerChainSelectView
