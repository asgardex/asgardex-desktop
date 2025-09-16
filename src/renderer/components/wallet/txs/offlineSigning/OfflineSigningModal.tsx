import React, { useCallback, useState } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { ArrowDownTrayIcon, ArrowUpTrayIcon, DocumentCheckIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { formatAssetAmountCurrency, baseToAsset } from '@xchainjs/xchain-util'
import { either as E, function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { OfflineTxBundle, SignedTxBundle, OfflineSigningStatus } from '../../../../../shared/api/offlineTx'
import { BaseButton, FlatButton } from '../../../uielements/button'
import { Modal } from '../../../uielements/modal'
import * as Styled from '../TxForm.styles'

interface Props {
  visible: boolean
  onClose: () => void
  status: OfflineSigningStatus
  bundle?: OfflineTxBundle
  signedBundle?: SignedTxBundle
  network: Network
  onExportUnsigned: () => void
  onImportSigned: () => void
  onBroadcast: () => void
}

export const OfflineSigningModal: React.FC<Props> = ({
  visible,
  onClose,
  status,
  bundle,
  signedBundle,
  network,
  onExportUnsigned,
  onImportSigned,
  onBroadcast
}) => {
  const intl = useIntl()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleExportUnsigned = useCallback(async () => {
    if (!bundle) return

    setIsExporting(true)
    try {
      const result = await window.apiOfflineTransaction.exportUnsignedTx(bundle)
      if (E.isRight(result)) {
        console.log('Transaction exported to:', result.right)
        onExportUnsigned()
      } else {
        console.error('Export failed:', result.left.message)
      }
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setIsExporting(false)
    }
  }, [bundle, onExportUnsigned])

  const handleImportSigned = useCallback(async () => {
    setIsImporting(true)
    try {
      const result = await window.apiOfflineTransaction.importSignedTx()
      if (E.isRight(result)) {
        console.log('Signed transaction imported')
        onImportSigned()
      } else {
        console.error('Import failed:', result.left.message)
      }
    } catch (error) {
      console.error('Import error:', error)
    } finally {
      setIsImporting(false)
    }
  }, [onImportSigned])

  const renderContent = () => {
    switch (status) {
      case OfflineSigningStatus.READY_FOR_EXPORT:
        return (
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold">Export Unsigned Transaction</h3>

            {bundle && (
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded">
                <p className="text-sm mb-2">Transaction Details:</p>
                <div className="text-xs space-y-1">
                  <p>Chain: {bundle.chain}</p>
                  <p>Network: {bundle.network}</p>
                  <p>From: {bundle.metadata.sender}</p>
                  <p>To: {bundle.metadata.recipient}</p>
                  <p>
                    Amount:{' '}
                    {formatAssetAmountCurrency({
                      amount: baseToAsset(bundle.metadata.amount),
                      asset: bundle.metadata.asset,
                      decimal: 8
                    })}
                  </p>
                  {bundle.metadata.memo && <p>Memo: {bundle.metadata.memo}</p>}
                  <p>
                    Fee:{' '}
                    {formatAssetAmountCurrency({
                      amount: baseToAsset(bundle.metadata.estimatedFee),
                      asset: bundle.metadata.asset,
                      decimal: 8
                    })}
                  </p>
                </div>
              </div>
            )}

            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>1. Click "Export to USB" to save the unsigned transaction</p>
              <p>2. Transfer the file to your offline computer via USB</p>
              <p>3. Sign the transaction on the offline computer</p>
              <p>4. Transfer the signed file back via USB</p>
            </div>

            <BaseButton onClick={handleExportUnsigned} loading={isExporting} className="w-full">
              <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
              Export to USB
            </BaseButton>
          </div>
        )

      case OfflineSigningStatus.EXPORTED:
        return (
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold">Import Signed Transaction</h3>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>After signing the transaction on your offline computer:</p>
              <p>1. Transfer the signed file back via USB</p>
              <p>2. Click "Import from USB" to load the signed transaction</p>
              <p>3. Review and broadcast the transaction</p>
            </div>

            <BaseButton onClick={handleImportSigned} loading={isImporting} className="w-full">
              <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
              Import from USB
            </BaseButton>
          </div>
        )

      case OfflineSigningStatus.SIGNED:
        return (
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold">Broadcast Transaction</h3>

            {signedBundle && (
              <div className="bg-green-100 dark:bg-green-900 p-4 rounded">
                <p className="text-sm mb-2 text-green-800 dark:text-green-200">✓ Transaction signed successfully</p>
                <div className="text-xs space-y-1">
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

      case OfflineSigningStatus.BROADCAST_SUCCESS:
        return (
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-green-600">Transaction Broadcast Successfully!</h3>
            <p className="text-sm">Your transaction has been submitted to the network.</p>
            <BaseButton onClick={onClose} className="w-full">
              Close
            </BaseButton>
          </div>
        )

      case OfflineSigningStatus.ERROR:
        return (
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-red-600">Error</h3>
            <p className="text-sm">An error occurred during the offline signing process.</p>
            <BaseButton onClick={onClose} className="w-full">
              Close
            </BaseButton>
          </div>
        )

      default:
        return (
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold">Preparing Transaction...</h3>
            <p className="text-sm">Please wait while the transaction is being prepared.</p>
          </div>
        )
    }
  }

  return (
    <Modal
      title="Offline Transaction Signing"
      visible={visible}
      onCancel={onClose}
      footer={false}
      panelClassName="max-w-lg">
      {renderContent()}
    </Modal>
  )
}
