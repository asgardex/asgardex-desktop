import React, { useState, useEffect } from 'react'
import { ShieldCheckIcon, CogIcon } from '@heroicons/react/24/outline'

import { WalletMode, WatchOnlyWallet } from '../../../../shared/api/offlineTx'
import { BaseButton, FlatButton } from '../../uielements/button'
import { watchOnlyWalletService } from '../../../services/wallet/watchOnlyWallet'
import { OfflineSigningSetup } from './OfflineSigningSetup'
import { OfflineTransactionFlow } from './OfflineTransactionFlow'

interface Props {
  className?: string
  onStartOfflineTransaction?: () => void
}

export const OfflineSigningButton: React.FC<Props> = ({ className = '', onStartOfflineTransaction }) => {
  const [showSetup, setShowSetup] = useState(false)
  const [showFlow, setShowFlow] = useState(false)
  const [walletMode, setWalletMode] = useState<WalletMode>(WalletMode.NORMAL)

  useEffect(() => {
    const modeSubscription = watchOnlyWalletService.walletMode$.subscribe(setWalletMode)
    return () => modeSubscription.unsubscribe()
  }, [])

  const handleModeChange = (mode: WalletMode) => {
    watchOnlyWalletService.setWalletMode(mode)
  }

  const renderNormalMode = () => (
    <BaseButton onClick={() => setShowSetup(true)} className={`flex items-center space-x-2 ${className}`}>
      <ShieldCheckIcon className="w-5 h-5" />
      <span>Setup Offline Signing</span>
    </BaseButton>
  )

  const renderWatchOnlyMode = () => (
    <div className="flex items-center space-x-2">
      <BaseButton
        onClick={() => {
          if (onStartOfflineTransaction) {
            onStartOfflineTransaction()
          } else {
            setShowFlow(true)
          }
        }}
        className="bg-blue-600 hover:bg-blue-700">
        <ShieldCheckIcon className="w-5 h-5 mr-2" />
        Prepare Offline Transaction
      </BaseButton>

      <FlatButton onClick={() => setShowSetup(true)}>
        <CogIcon className="w-5 h-5" />
      </FlatButton>
    </div>
  )

  const renderOfflineMode = () => (
    <BaseButton onClick={() => setShowFlow(true)} className={`bg-orange-600 hover:bg-orange-700 ${className}`}>
      <ShieldCheckIcon className="w-5 h-5 mr-2" />
      Sign Offline Transaction
    </BaseButton>
  )

  const renderByMode = () => {
    switch (walletMode) {
      case WalletMode.ONLINE_WATCH_ONLY:
        return renderWatchOnlyMode()
      case WalletMode.OFFLINE_SIGNER:
        return renderOfflineMode()
      default:
        return renderNormalMode()
    }
  }

  return (
    <>
      {renderByMode()}

      <OfflineSigningSetup visible={showSetup} onClose={() => setShowSetup(false)} onModeChange={handleModeChange} />

      <OfflineTransactionFlow
        visible={showFlow}
        onClose={() => setShowFlow(false)}
        status={'PREPARING' as any} // This would be passed from parent
        onExportUnsigned={() => {}}
        onImportSigned={() => {}}
        onBroadcast={() => {}}
      />
    </>
  )
}
