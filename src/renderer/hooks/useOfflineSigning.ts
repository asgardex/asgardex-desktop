import { useCallback, useEffect, useState } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { either as E, function as FP } from 'fp-ts'
import * as Rx from 'rxjs'

import { OfflineTxBundle, SignedTxBundle, OfflineSigningStatus } from '../../shared/api/offlineTx'
import { createOfflineTransactionService, PrepareTxParams } from '../services/thorchain/offlineTransaction'
import { useThorchainContext } from '../contexts/ThorchainContext'
import { useNetwork } from './useNetwork'

export const useOfflineSigning = () => {
  const { network } = useNetwork()
  const { client$ } = useThorchainContext()

  const [status, setStatus] = useState<OfflineSigningStatus>(OfflineSigningStatus.PREPARING)
  const [unsignedBundle, setUnsignedBundle] = useState<OfflineTxBundle | undefined>()
  const [signedBundle, setSignedBundle] = useState<SignedTxBundle | undefined>()
  const [error, setError] = useState<string | undefined>()

  // Create the offline transaction service
  const offlineService = createOfflineTransactionService(client$, Rx.of(network))

  // Subscribe to status updates
  useEffect(() => {
    const subscription = offlineService.status$.subscribe(setStatus)
    return () => subscription.unsubscribe()
  }, [offlineService])

  /**
   * Prepare an unsigned transaction for offline signing
   */
  const prepareTx = useCallback(
    (params: PrepareTxParams) => {
      setError(undefined)

      const subscription = offlineService.prepareTx$(params).subscribe((result) => {
        if (RD.isSuccess(result)) {
          setUnsignedBundle(result.value)
          setStatus(OfflineSigningStatus.READY_FOR_EXPORT)
        } else if (RD.isFailure(result)) {
          setError(result.error.message)
          setStatus(OfflineSigningStatus.ERROR)
        }
      })

      return () => subscription.unsubscribe()
    },
    [offlineService]
  )

  /**
   * Export unsigned transaction to USB
   */
  const exportUnsignedTx = useCallback(async () => {
    if (!unsignedBundle) {
      setError('No unsigned transaction to export')
      return false
    }

    try {
      const result = await window.apiOfflineTransaction.exportUnsignedTx(unsignedBundle)
      if (E.isRight(result)) {
        setStatus(OfflineSigningStatus.EXPORTED)
        return true
      } else {
        setError(result.left.message)
        setStatus(OfflineSigningStatus.ERROR)
        return false
      }
    } catch (err) {
      setError(`Export failed: ${err}`)
      setStatus(OfflineSigningStatus.ERROR)
      return false
    }
  }, [unsignedBundle])

  /**
   * Import signed transaction from USB
   */
  const importSignedTx = useCallback(async () => {
    try {
      const result = await window.apiOfflineTransaction.importSignedTx()
      if (E.isRight(result)) {
        setSignedBundle(result.right)
        setStatus(OfflineSigningStatus.SIGNED)
        return true
      } else {
        setError(result.left.message)
        setStatus(OfflineSigningStatus.ERROR)
        return false
      }
    } catch (err) {
      setError(`Import failed: ${err}`)
      setStatus(OfflineSigningStatus.ERROR)
      return false
    }
  }, [])

  /**
   * Broadcast signed transaction
   */
  const broadcastTx = useCallback(() => {
    if (!signedBundle) {
      setError('No signed transaction to broadcast')
      return
    }

    const subscription = offlineService.broadcastTx$(signedBundle).subscribe((result) => {
      if (RD.isSuccess(result)) {
        setStatus(OfflineSigningStatus.BROADCAST_SUCCESS)
      } else if (RD.isFailure(result)) {
        setError(result.error.msg)
        setStatus(OfflineSigningStatus.ERROR)
      }
    })

    return () => subscription.unsubscribe()
  }, [signedBundle, offlineService])

  /**
   * Sign transaction offline (for use on offline computer)
   */
  const signTxOffline = useCallback(
    async (password: string) => {
      try {
        // First import the unsigned transaction
        const importResult = await window.apiOfflineTransaction.importUnsignedTx()
        if (E.isLeft(importResult)) {
          setError(importResult.left.message)
          return false
        }

        const bundle = importResult.right
        setUnsignedBundle(bundle)

        // Sign the transaction
        const subscription = offlineService.signTx$(bundle, password).subscribe((result) => {
          if (RD.isSuccess(result)) {
            setSignedBundle(result.value)
            setStatus(OfflineSigningStatus.SIGNED)

            // Auto-export the signed transaction
            window.apiOfflineTransaction.exportSignedTx(result.value).then((exportResult) => {
              if (E.isLeft(exportResult)) {
                setError(`Export failed: ${exportResult.left.message}`)
              }
            })
          } else if (RD.isFailure(result)) {
            setError(result.error.message)
            setStatus(OfflineSigningStatus.ERROR)
          }
        })

        return () => subscription.unsubscribe()
      } catch (err) {
        setError(`Signing failed: ${err}`)
        setStatus(OfflineSigningStatus.ERROR)
        return false
      }
    },
    [offlineService]
  )

  /**
   * Reset the offline signing state
   */
  const reset = useCallback(() => {
    setStatus(OfflineSigningStatus.PREPARING)
    setUnsignedBundle(undefined)
    setSignedBundle(undefined)
    setError(undefined)
    offlineService.resetStatus()
  }, [offlineService])

  /**
   * Clear transaction files from USB
   */
  const clearUSBFiles = useCallback(async (path?: string) => {
    try {
      const result = await window.apiOfflineTransaction.clearTxFiles(path)
      if (E.isRight(result)) {
        return result.right
      } else {
        setError(result.left.message)
        return 0
      }
    } catch (err) {
      setError(`Clear files failed: ${err}`)
      return 0
    }
  }, [])

  return {
    status,
    unsignedBundle,
    signedBundle,
    error,
    prepareTx,
    exportUnsignedTx,
    importSignedTx,
    broadcastTx,
    signTxOffline,
    reset,
    clearUSBFiles
  }
}
