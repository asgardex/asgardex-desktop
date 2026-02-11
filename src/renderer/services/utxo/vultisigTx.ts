/**
 * Shared Vultisig transaction handler for UTXO chains
 *
 * UTXO chains (BTC, LTC, DOGE, DASH, BCH) use PSBT (Partially Signed Bitcoin Transaction)
 * format for transaction signing. This module provides a factory function to create
 * chain-specific Vultisig transaction handlers.
 */
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'
import * as Bitcoin from 'bitcoinjs-lib'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { XChainClient$ } from '../clients/types'
import { appWalletService } from '../wallet/appWallet'
import { ErrorId, TxHashLD } from '../wallet/types'
import { isSignatureEvent, signBytes$ } from '../wallet/vultisigSigning'
import { SendTxParams } from './types'

/**
 * Creates a Vultisig transaction handler for UTXO chains
 *
 * @param client$ - Observable of the chain client
 * @param chainName - Chain identifier for MPC signing (e.g., 'BTC', 'LTC', 'DOGE', 'DASH')
 * @returns Function that handles Vultisig UTXO transactions
 */
export const createVultisigUtxoTx = (
  client$: XChainClient$,
  chainName: string
): (({ network, params }: { network: Network; params: SendTxParams }) => TxHashLD) => {
  // Note: network param is unused for Vultisig but included for API consistency with Ledger
  return ({ params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const { recipient, amount, memo, feeRate } = params

    // Get vaultId from active wallet state (unified approach - same as EVM)
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
                // 1. Build unsigned PSBT
                Rx.defer(() => {
                  window.apiLog.info('[Vultisig]', `${chainName} step 1: prepareTx`, {
                    sender,
                    recipient,
                    amount: amount.amount().toString()
                  })
                  return Rx.from(
                    client.prepareTx({ sender, recipient, amount, memo, feeRate } as Parameters<
                      typeof client.prepareTx
                    >[0])
                  )
                }),
                RxOp.switchMap(({ rawUnsignedTx }) => {
                  window.apiLog.info('[Vultisig]', `${chainName} step 2: parsing PSBT`)
                  // 2. Parse PSBT from Base64
                  const psbt = Bitcoin.Psbt.fromBase64(rawUnsignedTx)

                  // 3. Create MPC async signer
                  // Note: vaultId is the ECDSA public key hex from Vultisig SDK
                  // The SDK returns vault.id as the compressed ECDSA public key (33 bytes = 66 hex chars)
                  const publicKey = Buffer.from(vaultId, 'hex')
                  window.apiLog.info('[Vultisig]', `${chainName} step 3: creating MPC signer`, {
                    publicKeyLength: publicKey.length,
                    vaultIdLength: vaultId.length
                  })

                  const mpcSignerAsync: Bitcoin.SignerAsync = {
                    publicKey,
                    sign: async (hash: Buffer): Promise<Buffer> => {
                      window.apiLog.info('[Vultisig]', `${chainName} step 4: signing hash with signBytes$`, {
                        hashHex: hash.toString('hex')
                      })
                      // Use Observable wrapper for proper event handling (QR, device joined, progress)
                      // Convert back to Promise using toPromise with first() for RxJS 6.x compatibility
                      const result = await signBytes$({
                        vaultId,
                        chain: chainName,
                        data: hash.toString('hex')
                      })
                        .pipe(RxOp.filter(isSignatureEvent), RxOp.first())
                        .toPromise()

                      if (!result) {
                        throw new Error('MPC signing failed: no signature received')
                      }

                      window.apiLog.info('[Vultisig]', `${chainName} step 4: got signature`, {
                        signatureLength: result.signature.length
                      })
                      return Buffer.from(result.signature, 'hex')
                    }
                  }

                  // 4. Sign all inputs asynchronously with MPC
                  return FP.pipe(
                    Rx.from(
                      (async () => {
                        window.apiLog.info('[Vultisig]', `${chainName} step 5: signing all inputs`)
                        await psbt.signAllInputsAsync(mpcSignerAsync)
                        // 5. Finalize all inputs
                        window.apiLog.info('[Vultisig]', `${chainName} step 6: finalizing inputs`)
                        psbt.finalizeAllInputs()
                        // 6. Extract signed transaction
                        const txHex = psbt.extractTransaction().toHex()
                        window.apiLog.info('[Vultisig]', `${chainName} step 7: extracted tx`, {
                          txHexLength: txHex.length
                        })
                        return txHex
                      })()
                    ),
                    // 7. Broadcast
                    RxOp.switchMap((txHex) => {
                      window.apiLog.info('[Vultisig]', `${chainName} step 8: broadcasting`)
                      return Rx.from(client.broadcastTx(txHex))
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
