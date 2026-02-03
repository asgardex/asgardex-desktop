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
    const { recipient, amount, memo } = params

    // Get vaultId from active wallet state (unified approach)
    const vaultId = appWalletService.getActiveVaultId()

    if (!vaultId) {
      window.apiLog.error('[Vultisig]', `${chainName} tx failed: no active vault`)
      return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'No active Vultisig vault' }))
    }

    // Get sender address from unified address service and client
    return FP.pipe(
      Rx.combineLatest([client$, appWalletService.getAddressForChain$(chainName as Chain)]),
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
                // 1. Build unsigned transaction
                Rx.defer(() => {
                  window.apiLog.info('[Vultisig]', `${chainName} step 1: prepareTx`, {
                    sender,
                    recipient,
                    amount: amount.amount().toString()
                  })
                  return Rx.from(client.prepareTx({ sender, recipient, amount, memo })).pipe(
                    RxOp.tap((result) =>
                      window.apiLog.info('[Vultisig]', `${chainName} prepareTx result`, {
                        hasRawTx: !!result?.rawUnsignedTx
                      })
                    ),
                    RxOp.catchError((err) => {
                      window.apiLog.error('[Vultisig]', `${chainName} prepareTx failed`, {
                        error: err?.message ?? String(err)
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

                  // 4. Sign with MPC
                  window.apiLog.info('[Vultisig]', `${chainName} step 4: calling signBytes`)
                  return FP.pipe(
                    Rx.from(
                      window.apiMpc.signBytes({
                        vaultId,
                        chain: chainName,
                        data: signingHash.slice(2) // Remove 0x prefix
                      })
                    ),
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
