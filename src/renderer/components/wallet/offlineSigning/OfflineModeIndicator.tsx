import React, { useEffect, useState } from 'react'
import { ShieldCheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

import { WalletMode, WatchOnlyWallet } from '../../../../shared/api/offlineTx'
import { watchOnlyWalletService } from '../../../services/wallet/watchOnlyWallet'

interface Props {
  className?: string
}

export const OfflineModeIndicator: React.FC<Props> = ({ className = '' }) => {
  const [walletMode, setWalletMode] = useState<WalletMode>(WalletMode.NORMAL)
  const [watchWallets, setWatchWallets] = useState<WatchOnlyWallet[]>([])

  useEffect(() => {
    const modeSubscription = watchOnlyWalletService.walletMode$.subscribe(setWalletMode)
    const walletsSubscription = watchOnlyWalletService.watchWallets$.subscribe(setWatchWallets)

    return () => {
      modeSubscription.unsubscribe()
      walletsSubscription.unsubscribe()
    }
  }, [])

  if (walletMode === WalletMode.NORMAL) {
    return null
  }

  const getIndicatorContent = () => {
    switch (walletMode) {
      case WalletMode.ONLINE_WATCH_ONLY:
        return {
          icon: <GlobeAltIcon className="w-5 h-5" />,
          label: 'Watch-Only Mode',
          description: `${watchWallets.length} watch wallets`,
          bgColor: 'bg-blue-100 dark:bg-blue-900',
          textColor: 'text-blue-800 dark:text-blue-200',
          borderColor: 'border-blue-300 dark:border-blue-700'
        }

      case WalletMode.OFFLINE_SIGNER:
        return {
          icon: <ShieldCheckIcon className="w-5 h-5" />,
          label: 'Offline Signer',
          description: 'Air-gapped mode',
          bgColor: 'bg-orange-100 dark:bg-orange-900',
          textColor: 'text-orange-800 dark:text-orange-200',
          borderColor: 'border-orange-300 dark:border-orange-700'
        }

      default:
        return null
    }
  }

  const content = getIndicatorContent()
  if (!content) return null

  return (
    <div
      className={`
      flex items-center space-x-2 px-3 py-2 rounded-lg border
      ${content.bgColor} ${content.textColor} ${content.borderColor}
      ${className}
    `}>
      {content.icon}
      <div className="flex flex-col">
        <span className="text-sm font-medium">{content.label}</span>
        <span className="text-xs opacity-80">{content.description}</span>
      </div>
    </div>
  )
}
