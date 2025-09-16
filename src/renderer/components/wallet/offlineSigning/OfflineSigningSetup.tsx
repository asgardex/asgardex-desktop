import React, { useCallback, useState, useEffect } from 'react'
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ComputerDesktopIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { either as E } from 'fp-ts'

import { WalletMode, WatchOnlyWallet } from '../../../../shared/api/offlineTx'
import { watchOnlyWalletService, createWatchWalletFromAddress } from '../../../services/wallet/watchOnlyWallet'
import { BaseButton, FlatButton } from '../../uielements/button'
import { Modal } from '../../uielements/modal'

interface Props {
  visible: boolean
  onClose: () => void
  onModeChange: (mode: WalletMode) => void
}

export const OfflineSigningSetup: React.FC<Props> = ({ visible, onClose, onModeChange }) => {
  const [step, setStep] = useState<'choose' | 'export' | 'import'>('choose')
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
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

  const handleExportWatchWallets = useCallback(async () => {
    setIsExporting(true)
    try {
      // For demo, create a sample watch wallet from current address
      // In real implementation, this would extract public keys from current wallet
      const sampleWallet = createWatchWalletFromAddress(
        'thor1abc123...', // Replace with actual address
        THORChain,
        0
      )

      watchOnlyWalletService.addWatchWallet(sampleWallet)

      const result = await watchOnlyWalletService.exportWatchWallets()
      if (E.isRight(result)) {
        setStep('import')
      } else {
        console.error('Export failed:', result.left.message)
      }
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setIsExporting(false)
    }
  }, [])

  const handleImportWatchWallets = useCallback(async () => {
    setIsImporting(true)
    try {
      const result = await watchOnlyWalletService.importWatchWallets()
      if (E.isRight(result)) {
        onModeChange(WalletMode.ONLINE_WATCH_ONLY)
        onClose()
      } else {
        console.error('Import failed:', result.left.message)
      }
    } catch (error) {
      console.error('Import error:', error)
    } finally {
      setIsImporting(false)
    }
  }, [onModeChange, onClose])

  const renderChooseStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <ShieldCheckIcon className="w-16 h-16 mx-auto text-blue-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Setup Offline Signing</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Choose your setup method for secure offline transaction signing
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-6 hover:border-blue-500 transition-colors">
          <ComputerDesktopIcon className="w-8 h-8 text-blue-500 mb-3" />
          <h4 className="font-semibold mb-2">I have the Private Keys</h4>
          <p className="text-sm text-gray-600 mb-4">
            This computer has the keystore with private keys. Export watch-only addresses for the online computer.
          </p>
          <BaseButton onClick={() => setStep('export')} className="w-full">
            Export Watch Wallets
          </BaseButton>
        </div>

        <div className="border rounded-lg p-6 hover:border-green-500 transition-colors">
          <ArrowUpTrayIcon className="w-8 h-8 text-green-500 mb-3" />
          <h4 className="font-semibold mb-2">I need Watch-Only Mode</h4>
          <p className="text-sm text-gray-600 mb-4">
            This is the online computer. Import watch-only addresses from your offline computer.
          </p>
          <BaseButton onClick={() => setStep('import')} className="w-full bg-green-600 hover:bg-green-700">
            Import Watch Wallets
          </BaseButton>
        </div>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg">
        <h5 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Security Note</h5>
        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
          <li>• Private keys stay on the offline computer</li>
          <li>• Online computer only gets public addresses</li>
          <li>• Use a clean USB drive for file transfers</li>
          <li>• Verify all transaction details before signing</li>
        </ul>
      </div>
    </div>
  )

  const renderExportStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <ArrowDownTrayIcon className="w-16 h-16 mx-auto text-blue-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Export Watch-Only Wallets</h3>
        <p className="text-gray-600 dark:text-gray-400">Export public addresses to use on your online computer</p>
      </div>

      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
          <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">What gets exported:</h5>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Public addresses only (no private keys)</li>
            <li>• Chain information (THORChain, Bitcoin, etc.)</li>
            <li>• Wallet derivation paths</li>
            <li>• Account indices</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h5 className="font-semibold">Instructions:</h5>
          <ol className="text-sm space-y-2">
            <li>1. Insert a clean USB drive</li>
            <li>2. Click &quot;Export to USB&quot; to save watch wallet file</li>
            <li>3. Safely eject USB and take it to your online computer</li>
            <li>4. On online computer, import the watch wallet file</li>
          </ol>
        </div>

        <BaseButton onClick={handleExportWatchWallets} loading={isExporting} className="w-full">
          <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
          Export to USB
        </BaseButton>
      </div>
    </div>
  )

  const renderImportStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <ArrowUpTrayIcon className="w-16 h-16 mx-auto text-green-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Import Watch-Only Wallets</h3>
        <p className="text-gray-600 dark:text-gray-400">Import public addresses from your offline computer</p>
      </div>

      <div className="space-y-4">
        <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
          <h5 className="font-semibold text-green-800 dark:text-green-200 mb-2">After import:</h5>
          <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
            <li>• ASGARDEX switches to watch-only mode</li>
            <li>• You can prepare transactions for offline signing</li>
            <li>• Balances and transaction history remain visible</li>
            <li>• No private operations (signing) are possible</li>
          </ul>
        </div>

        {walletMode === WalletMode.ONLINE_WATCH_ONLY && (
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
            <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Current Watch Wallets: {watchWallets.length}
            </h5>
            {watchWallets.map((wallet, index) => (
              <div key={index} className="text-sm text-blue-700 dark:text-blue-300">
                {wallet.chain}: {wallet.address.slice(0, 12)}...
              </div>
            ))}
          </div>
        )}

        <BaseButton
          onClick={handleImportWatchWallets}
          loading={isImporting}
          className="w-full bg-green-600 hover:bg-green-700">
          <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
          Import from USB
        </BaseButton>
      </div>
    </div>
  )

  const renderCurrentStep = () => {
    switch (step) {
      case 'export':
        return renderExportStep()
      case 'import':
        return renderImportStep()
      default:
        return renderChooseStep()
    }
  }

  return (
    <Modal title="Offline Signing Setup" visible={visible} onCancel={onClose} footer={false} panelClassName="max-w-2xl">
      {renderCurrentStep()}
      <div className="flex justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        {step !== 'choose' && <FlatButton onClick={() => setStep('choose')}>Back</FlatButton>}
        <FlatButton onClick={onClose}>Close</FlatButton>
      </div>
    </Modal>
  )
}
