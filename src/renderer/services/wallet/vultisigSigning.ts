/**
 * Vultisig Signing Observable Wrapper
 *
 * Provides an Observable-based wrapper around the Promise-based signBytes IPC call.
 * This ensures that IPC callback events (QR ready, device joined, progress) are properly
 * emitted during the signing ceremony for SecureVault (2-of-2) transactions.
 *
 * The core issue this solves: When using Rx.from(Promise), callbacks that fire
 * DURING the await never reach the Observable chain because the Promise hasn't
 * resolved yet. By setting up event listeners FIRST, then calling signBytes,
 * we guarantee all events are captured.
 */
import * as Rx from 'rxjs'

import { DeviceJoinedData, SignBytesParams, SignBytesResult, SignProgressData } from '../../../shared/api/mpcTypes'

// ============================================
// Event Types for Signing Observable
// ============================================

export type VultisigSignEvent =
  | { type: 'qr-ready'; payload: string }
  | { type: 'device-joined'; deviceId: string; totalJoined: number; required: number }
  | { type: 'progress'; step: string; message?: string; progress?: number }
  | { type: 'signature'; signature: string; recovery?: number }
  | { type: 'error'; error: Error }

// ============================================
// Observable Wrapper for signBytes
// ============================================

/**
 * Observable-based wrapper for window.apiMpc.signBytes
 *
 * This wraps the Promise-based signBytes call in an Observable that:
 * 1. Sets up IPC event listeners BEFORE calling signBytes
 * 2. Emits events as they arrive (qr-ready, device-joined, progress)
 * 3. Emits the final signature when the Promise resolves
 * 4. Properly cleans up listeners on unsubscribe or completion
 *
 * @param params - Sign parameters (vaultId, chain, data)
 * @returns Observable that emits VultisigSignEvent
 */
export const signBytes$ = (params: SignBytesParams): Rx.Observable<VultisigSignEvent> => {
  return new Rx.Observable<VultisigSignEvent>((subscriber) => {
    window.apiLog.info('[VultisigSign$]', 'Setting up event listeners', { chain: params.chain })

    // Set up event listeners FIRST (before calling signBytes)
    const cleanupQR = window.apiMpc.onSignQRReady((payload: string) => {
      window.apiLog.info('[VultisigSign$]', 'QR ready event received')
      subscriber.next({ type: 'qr-ready', payload })
    })

    const cleanupDevice = window.apiMpc.onSignDeviceJoined((data: DeviceJoinedData) => {
      window.apiLog.info('[VultisigSign$]', 'Device joined event received', data)
      subscriber.next({
        type: 'device-joined',
        deviceId: data.deviceId,
        totalJoined: data.totalJoined,
        required: data.required
      })
    })

    const cleanupProgress = window.apiMpc.onSignProgress((data: SignProgressData) => {
      window.apiLog.info('[VultisigSign$]', 'Progress event received', data)
      subscriber.next({
        type: 'progress',
        step: data.step,
        message: data.message,
        progress: data.progress
      })
    })

    // THEN call signBytes
    window.apiLog.info('[VultisigSign$]', 'Calling window.apiMpc.signBytes', { chain: params.chain })

    window.apiMpc
      .signBytes(params)
      .then((result: SignBytesResult) => {
        window.apiLog.info('[VultisigSign$]', 'signBytes resolved', {
          signatureLength: result.signature.length,
          recovery: result.recovery
        })
        subscriber.next({
          type: 'signature',
          signature: result.signature,
          recovery: result.recovery
        })
        subscriber.complete()
      })
      .catch((error: Error) => {
        window.apiLog.error('[VultisigSign$]', 'signBytes rejected', { error: error.message })
        subscriber.next({ type: 'error', error })
        subscriber.error(error)
      })

    // Cleanup on unsubscribe
    return () => {
      window.apiLog.info('[VultisigSign$]', 'Cleaning up event listeners')
      cleanupQR()
      cleanupDevice()
      cleanupProgress()
    }
  })
}

// ============================================
// Helper: Extract Signature from Event Stream
// ============================================

/**
 * Filters the event stream to extract only the final signature result.
 *
 * Usage in transaction handlers:
 * ```ts
 * return signBytes$(params).pipe(
 *   filterSignatureResult(),
 *   RxOp.map(result => ({ signature: result.signature, recovery: result.recovery }))
 * )
 * ```
 */
export const isSignatureEvent = (
  event: VultisigSignEvent
): event is { type: 'signature'; signature: string; recovery?: number } => event.type === 'signature'
