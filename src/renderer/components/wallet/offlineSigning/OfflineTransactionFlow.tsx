import React, { useState, useCallback, useEffect } from 'react'
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { formatAssetAmountCurrency, baseToAsset } from '@xchainjs/xchain-util'

import {
  OfflineSigningStatus,
  OfflineTxBundle,
  SignedTxBundle,
  WalletMode,
  WatchOnlyWallet
} from '../../../../shared/api/offlineTx'
import { BaseButton } from '../../uielements/button'
import { Modal } from '../../uielements/modal'
import { watchOnlyWalletService } from '../../../services/wallet/watchOnlyWallet'

interface Props {
  visible: boolean
  onClose: () => void
  status: OfflineSigningStatus
  bundle?: OfflineTxBundle
  signedBundle?: SignedTxBundle
  onExportUnsigned: () => void
  onImportSigned: () => void
  onBroadcast: () => void
  onSignOffline?: (password: string) => void // For offline computer
}

export const OfflineTransactionFlow: React.FC<Props> = ({
  visible,
  onClose,
  status,
  bundle,
  signedBundle,
  onExportUnsigned,
  onImportSigned,
  onBroadcast,
  onSignOffline
}) => {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [password, setPassword] = useState('')
  const [walletMode, setWalletMode] = useState<WalletMode>(WalletMode.NORMAL)

  useEffect(() => {
    const modeSubscription = watchOnlyWalletService.walletMode$.subscribe(setWalletMode)
    return () => modeSubscription.unsubscribe()
  }, [])

  const isOnlineMode = walletMode === WalletMode.ONLINE_WATCH_ONLY
  const isOfflineMode = walletMode === WalletMode.OFFLINE_SIGNER

  const handleExportUnsigned = useCallback(async () => {
    setIsExporting(true)
    try {
      await onExportUnsigned()
    } finally {
      setIsExporting(false)
    }
  }, [onExportUnsigned])

  const handleImportSigned = useCallback(async () => {
    setIsImporting(true)
    try {
      await onImportSigned()
    } finally {
      setIsImporting(false)
    }
  }, [onImportSigned])

  const handleSignOffline = useCallback(() => {
    if (onSignOffline && password) {
      onSignOffline(password)
      setPassword('')
    }
  }, [onSignOffline, password])

  const renderTransactionDetails = (txBundle: OfflineTxBundle) => (
    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
      <h5 className="font-semibold mb-3">Transaction Details</h5>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Chain:</span>
          <span className="font-medium">{txBundle.chain}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Network:</span>
          <span className="font-medium">{txBundle.network}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">From:</span>
          <span className="font-mono text-xs">{txBundle.metadata.sender}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">To:</span>
          <span className="font-mono text-xs">{txBundle.metadata.recipient}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Amount:</span>
          <span className="font-medium">
            {formatAssetAmountCurrency({
              amount: baseToAsset(txBundle.metadata.amount),
              asset: txBundle.metadata.asset,
              decimal: 8
            })}
          </span>
        </div>
        {txBundle.metadata.memo && (
          <div className="flex justify-between">
            <span className="text-gray-600">Memo:</span>
            <span className="font-medium">{txBundle.metadata.memo}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-600">Fee:</span>
          <span className="font-medium">
            {formatAssetAmountCurrency({
              amount: baseToAsset(txBundle.metadata.estimatedFee),
              asset: txBundle.metadata.asset,
              decimal: 8
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Expires:</span>
          <span className="font-medium">{new Date(txBundle.expiresAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  )

  const renderOnlineFlow = () => {
    switch (status) {
      case OfflineSigningStatus.READY_FOR_EXPORT:
        return (
          <div className="space-y-4">
            <div className="text-center">
              <ArrowDownTrayIcon className="w-12 h-12 mx-auto text-blue-500 mb-3" />
              <h4 className="text-lg font-semibold">Export Unsigned Transaction</h4>
              <p className="text-gray-600">Ready to export transaction for offline signing</p>
            </div>

            {bundle && renderTransactionDetails(bundle)}

            <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
              <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Next Steps:</h5>
              <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>1. Click "Export to USB" to save the unsigned transaction</li>
                <li>2. Transfer the USB to your offline computer</li>
                <li>3. Sign the transaction on the offline computer</li>
                <li>4. Transfer the signed transaction back via USB</li>
              </ol>
            </div>

            <BaseButton onClick={handleExportUnsigned} loading={isExporting} className="w-full">
              <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
              Export to USB
            </BaseButton>
          </div>
        )

      case OfflineSigningStatus.EXPORTED:
        return (
          <div className="space-y-4">
            <div className="text-center">
              <ArrowUpTrayIcon className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <h4 className="text-lg font-semibold">Import Signed Transaction</h4>
              <p className="text-gray-600">Waiting for signed transaction from offline computer</p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg">
              <h5 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Waiting for Signature</h5>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                After signing the transaction on your offline computer, transfer the signed file back and import it
                here.
              </p>
            </div>

            <BaseButton onClick={handleImportSigned} loading={isImporting} className="w-full">
              <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
              Import Signed Transaction
            </BaseButton>
          </div>
        )

      case OfflineSigningStatus.SIGNED:
        return (
          <div className="space-y-4">
            <div className="text-center">
              <DocumentCheckIcon className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <h4 className="text-lg font-semibold">Ready to Broadcast</h4>
              <p className="text-gray-600">Transaction is signed and ready to broadcast</p>
            </div>

            {signedBundle && (
              <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
                <h5 className="font-semibold text-green-800 dark:text-green-200 mb-2">✓ Signature Verified</h5>
                <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <p>Signed at: {new Date(signedBundle.signedAt).toLocaleString()}</p>
                  <p>Signer: {signedBundle.signerAddress}</p>
                </div>
              </div>
            )}

            <BaseButton onClick={onBroadcast} className="w-full bg-green-600 hover:bg-green-700">
              <DocumentCheckIcon className="w-5 h-5 mr-2" />
              Broadcast Transaction
            </BaseButton>
          </div>
        )

      default:
        return (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Preparing transaction...</p>
          </div>
        )
    }
  }

  const renderOfflineFlow = () => {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 mx-auto text-orange-500 mb-3" />
          <h4 className="text-lg font-semibold">Offline Signing Mode</h4>
          <p className="text-gray-600">Sign transactions on this air-gapped computer</p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900 p-4 rounded-lg">
          <h5 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Instructions:</h5>
          <ol className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
            <li>1. Import unsigned transaction from USB</li>
            <li>2. Review transaction details carefully</li>
            <li>3. Enter your wallet password to sign</li>
            <li>4. Export signed transaction to USB</li>
          </ol>
        </div>

        <div className="space-y-3">
          <BaseButton
            onClick={() => {
              /* Import unsigned tx */
            }}
            className="w-full">
            <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
            Import Unsigned Transaction
          </BaseButton>

          {onSignOffline && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Wallet Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Enter password to sign"
              />
              <BaseButton
                onClick={handleSignOffline}
                disabled={!password}
                className="w-full bg-orange-600 hover:bg-orange-700">
                Sign Transaction
              </BaseButton>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Modal
      title={isOnlineMode ? 'Offline Transaction - Online' : 'Offline Transaction - Offline'}
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={500}>
      {isOnlineMode ? renderOnlineFlow() : renderOfflineFlow()}

      {status === OfflineSigningStatus.BROADCAST_SUCCESS && (
        <div className="mt-4 p-4 bg-green-100 dark:bg-green-800 rounded-lg text-center">
          <h4 className="text-lg font-semibold text-green-800 dark:text-green-200">
            Transaction Broadcast Successfully!
          </h4>
          <p className="text-sm text-green-600 dark:text-green-300 mt-1">
            Your transaction has been submitted to the network.
          </p>
        </div>
      )}

      {status === OfflineSigningStatus.ERROR && (
        <div className="mt-4 p-4 bg-red-100 dark:bg-red-800 rounded-lg text-center">
          <h4 className="text-lg font-semibold text-red-800 dark:text-red-200">Error Occurred</h4>
          <p className="text-sm text-red-600 dark:text-red-300 mt-1">
            An error occurred during the offline signing process.
          </p>
        </div>
      )}
    </Modal>
  )
}
