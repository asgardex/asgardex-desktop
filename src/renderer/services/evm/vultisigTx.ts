/**
 * Shared Vultisig transaction handler for EVM chains
 *
 * EVM chains (ETH, BSC, AVAX, ARB, BASE) use Ethers Transaction format.
 * This module provides a factory function to create chain-specific
 * Vultisig transaction handlers.
 */
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'
import { Transaction } from 'ethers'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { appWalletService } from '../wallet/appWallet'
import { ErrorId, TxHashLD } from '../wallet/types'
import { isSignatureEvent, signBytes$ } from '../wallet/vultisigSigning'
import { Client$, SendTxParams } from './types'

/**
 * Creates a Vultisig transaction handler for EVM chains
 *
 * @param client$ - Observable of the chain client
 * @param chainName - Chain identifier for MPC signing (e.g., 'ETH', 'BSC', 'AVAX', 'ARB', 'BASE')
 * @returns Function that handles Vultisig EVM transactions
 */
export const createVultisigEvmTx = (
  client$: Client$,
  chainName: string
): (({ network, params }: { network: Network; params: SendTxParams }) => TxHashLD) => {
  // Note: network param is unused for Vultisig but included for API consistency with Ledger
  return ({ params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const { recipient, amount, memo: _memo } = params

    // Get vaultId from active wallet state (unified approach)
    const vaultId = appWalletService.getActiveVaultId()

    if (!vaultId) {
      window.apiLog.error('[Vultisig]', `${chainName} tx failed: no active vault`)
      return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'No active Vultisig vault' }))
    }

    // Get sender address from unified address service and client
    // Use take(1) to prevent re-emission from cancelling our transaction
    return FP.pipe(
      Rx.combineLatest([client$, appWalletService.getAddressForChain$(chainName as Chain)]).pipe(
        RxOp.take(1),
        RxOp.tap(() => window.apiLog.info('[Vultisig]', `${chainName} combineLatest emitted (take 1)`))
      ),
      RxOp.switchMap(([oClient, oSender]) => {
        const sender = O.toUndefined(oSender)

        window.apiLog.info('[Vultisig]', `sendVultisigTx called for ${chainName}`, {
          sender,
          recipient,
          vaultId,
          amount: amount.amount().toString()
        })

        if (!sender) {
          window.apiLog.error('[Vultisig]', `${chainName} tx failed: no sender address`)
          return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: `No ${chainName} address available` }))
        }

        return FP.pipe(
          oClient,
          O.fold(
            () => {
              window.apiLog.error('[Vultisig]', `${chainName} tx failed: no client available`)
              return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: `No ${chainName} client available` }))
            },
            (client) =>
              FP.pipe(
                // 1. Build unsigned transaction with RPC diagnostics
                Rx.defer(() => {
                  const provider = client.getProvider()
                  window.apiLog.info('[Vultisig]', `${chainName} step 1: prepareTx`, {
                    sender,
                    recipient,
                    amount: amount.amount().toString(),
                    clientType: client?.constructor?.name,
                    hasProvider: !!provider,
                    providerType: provider?.constructor?.name
                  })

                  // Test individual RPC calls to find what's hanging
                  const runDiagnostics = async () => {
                    window.apiLog.info('[Vultisig]', `${chainName} RPC test 1: getBlockNumber`)
                    const blockNum = await Promise.race([
                      provider.getBlockNumber(),
                      new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('getBlockNumber timeout')), 10000)
                      )
                    ])
                    window.apiLog.info('[Vultisig]', `${chainName} RPC test 1 OK: block ${blockNum}`)

                    window.apiLog.info('[Vultisig]', `${chainName} RPC test 2: getTransactionCount`)
                    const nonce = await Promise.race([
                      provider.getTransactionCount(sender),
                      new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('getTransactionCount timeout')), 10000)
                      )
                    ])
                    window.apiLog.info('[Vultisig]', `${chainName} RPC test 2 OK: nonce ${nonce}`)

                    window.apiLog.info('[Vultisig]', `${chainName} RPC test 3: getFeeData`)
                    const feeData = await Promise.race([
                      provider.getFeeData(),
                      new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('getFeeData timeout')), 10000)
                      )
                    ])
                    window.apiLog.info('[Vultisig]', `${chainName} RPC test 3 OK: gasPrice ${feeData.gasPrice}`)

                    window.apiLog.info('[Vultisig]', `${chainName} RPC test 4: getNetwork (chainId)`)
                    const network = await Promise.race([
                      provider.getNetwork(),
                      new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('getNetwork timeout')), 10000)
                      )
                    ])
                    window.apiLog.info('[Vultisig]', `${chainName} RPC test 4 OK: chainId ${network.chainId}`)

                    // Build tx directly instead of using client.prepareTx (which has CachedValue issues)
                    window.apiLog.info('[Vultisig]', `${chainName} Building unsigned tx directly`)
                    const tx = new Transaction()
                    tx.type = 0 // Legacy transaction
                    tx.chainId = network.chainId
                    tx.to = recipient
                    tx.value = amount.amount().toFixed()
                    tx.nonce = nonce
                    // Gas fields required for serialization
                    tx.gasLimit = BigInt(21000) // Standard ETH transfer
                    tx.gasPrice = feeData.gasPrice

                    window.apiLog.info('[Vultisig]', `${chainName} Tx built`, {
                      type: tx.type,
                      chainId: Number(tx.chainId),
                      to: tx.to,
                      value: tx.value?.toString(),
                      nonce: tx.nonce,
                      gasLimit: tx.gasLimit?.toString(),
                      gasPrice: tx.gasPrice?.toString()
                    })

                    let rawUnsignedTx: string
                    try {
                      rawUnsignedTx = tx.unsignedSerialized
                      window.apiLog.info('[Vultisig]', `${chainName} Tx serialized OK`, {
                        rawTxLen: rawUnsignedTx.length
                      })
                    } catch (serializeErr) {
                      window.apiLog.error('[Vultisig]', `${chainName} Tx serialization FAILED`, {
                        error: String(serializeErr)
                      })
                      throw serializeErr
                    }

                    window.apiLog.info('[Vultisig]', `${chainName} runDiagnostics complete, returning`)
                    return { rawUnsignedTx }
                  }

                  // Timeout only covers tx preparation (RPC calls), NOT signing.
                  // The MPC signing ceremony (signBytes$) can take several minutes
                  // for SecureVault and must never be timed out here.
                  const prepareTxWithTimeout = async () => {
                    let timer: ReturnType<typeof setTimeout> | undefined
                    try {
                      const result = await Promise.race([
                        runDiagnostics(),
                        new Promise<never>((_, reject) => {
                          timer = setTimeout(() => {
                            window.apiLog.error('[Vultisig]', `${chainName} prepareTx TIMEOUT after 30s`)
                            reject(new Error(`prepareTx timeout after 30 seconds`))
                          }, 30000)
                        })
                      ])
                      return result
                    } finally {
                      // Always clear timeout to prevent stale timer from firing
                      // after runDiagnostics resolves
                      if (timer) clearTimeout(timer)
                    }
                  }

                  return Rx.from(prepareTxWithTimeout()).pipe(
                    RxOp.tap((result) =>
                      window.apiLog.info('[Vultisig]', `${chainName} prepareTx complete`, {
                        hasRawTx: !!result?.rawUnsignedTx
                      })
                    ),
                    RxOp.catchError((err) => {
                      window.apiLog.error('[Vultisig]', `${chainName} prepareTx failed`, {
                        error: err?.message ?? String(err),
                        name: err?.name
                      })
                      throw err
                    })
                  )
                }),
                RxOp.switchMap(({ rawUnsignedTx }) => {
                  window.apiLog.info('[Vultisig]', `${chainName} step 2: parsing tx`, {
                    rawTxLength: rawUnsignedTx?.length
                  })
                  // 2. Parse into Transaction object
                  const tx = Transaction.from(rawUnsignedTx)

                  // 3. Get the hash to sign
                  const signingHash = tx.unsignedHash
                  window.apiLog.info('[Vultisig]', `${chainName} step 3: signingHash`, { signingHash })

                  // 4. Sign with MPC using Observable wrapper for proper event handling
                  window.apiLog.info('[Vultisig]', `${chainName} step 4: calling signBytes$`)
                  return FP.pipe(
                    signBytes$({
                      vaultId,
                      chain: chainName,
                      data: signingHash.slice(2) // Remove 0x prefix
                    }),
                    // Filter to only get the signature result (ignores QR, device, progress events)
                    RxOp.filter(isSignatureEvent),
                    RxOp.switchMap(({ signature, recovery }) => {
                      window.apiLog.info('[Vultisig]', `${chainName} step 5: got signature`, {
                        signatureLen: signature.length,
                        recovery
                      })
                      // 5. Combine signature into signed transaction
                      // signature format: r (32 bytes) || s (32 bytes) = 64 bytes hex
                      const r = '0x' + signature.slice(0, 64)
                      const s = '0x' + signature.slice(64, 128)
                      const v = (recovery ?? 0) + 27

                      const signedTx = Transaction.from({
                        ...tx.toJSON(),
                        signature: { r, s, v }
                      }).serialized

                      // 6. Broadcast
                      window.apiLog.info('[Vultisig]', `${chainName} step 6: broadcasting`)
                      return Rx.from(client.broadcastTx(signedTx))
                    })
                  )
                }),
                RxOp.map((txHash) => {
                  window.apiLog.info('[Vultisig]', `${chainName} tx success`, { txHash })
                  return RD.success(txHash)
                }),
                RxOp.catchError((error) => {
                  window.apiLog.error('[Vultisig]', `${chainName} tx failed`, {
                    error: error?.message ?? error.toString()
                  })
                  return Rx.of(
                    RD.failure({
                      errorId: ErrorId.SEND_TX,
                      msg: `Vultisig ${chainName} tx failed: ${error?.message ?? error.toString()}`
                    })
                  )
                }),
                RxOp.startWith(RD.pending)
              )
          )
        )
      })
    )
  }
}
