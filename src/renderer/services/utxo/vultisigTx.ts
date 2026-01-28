/**
 * Shared Vultisig transaction handler for UTXO chains
 *
 * UTXO chains (BTC, LTC, DOGE, DASH, BCH) use PSBT (Partially Signed Bitcoin Transaction)
 * format for transaction signing. This module provides a factory function to create
 * chain-specific Vultisig transaction handlers.
 */
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import * as Bitcoin from 'bitcoinjs-lib'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { XChainClient$ } from '../clients/types'
import { ErrorId, TxHashLD } from '../wallet/types'
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
    const { sender, recipient, amount, memo, feeRate, vaultId } = params

    if (!vaultId) {
      return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'Vultisig transaction requires vaultId' }))
    }
    if (!sender) {
      return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'Sender address required' }))
    }

    return FP.pipe(
      client$,
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: `No ${chainName} client available` })),
            (client) =>
              FP.pipe(
                // 1. Build unsigned PSBT
                // Cast params since UTXO clients extend base TxParams with sender/feeRate
                Rx.from(
                  client.prepareTx({ sender, recipient, amount, memo, feeRate } as Parameters<
                    typeof client.prepareTx
                  >[0])
                ),
                RxOp.switchMap(({ rawUnsignedTx }) => {
                  // 2. Parse PSBT from Base64
                  const psbt = Bitcoin.Psbt.fromBase64(rawUnsignedTx)

                  // 3. Create MPC async signer - vaultId IS the ECDSA public key
                  const publicKey = Buffer.from(vaultId, 'hex')

                  const mpcSignerAsync: Bitcoin.SignerAsync = {
                    publicKey,
                    sign: async (hash: Buffer): Promise<Buffer> => {
                      const { signature } = await window.apiMpc.signBytes({
                        vaultId,
                        chain: chainName,
                        data: hash.toString('hex')
                      })
                      return Buffer.from(signature, 'hex')
                    }
                  }

                  // 4. Sign all inputs asynchronously with MPC
                  return FP.pipe(
                    Rx.from(
                      (async () => {
                        await psbt.signAllInputsAsync(mpcSignerAsync)
                        // 5. Finalize all inputs
                        psbt.finalizeAllInputs()
                        // 6. Extract signed transaction
                        return psbt.extractTransaction().toHex()
                      })()
                    ),
                    // 7. Broadcast
                    RxOp.switchMap((txHex) => Rx.from(client.broadcastTx(txHex)))
                  )
                }),
                RxOp.map((txHash) => RD.success(txHash)),
                RxOp.catchError((error) =>
                  Rx.of(
                    RD.failure({
                      errorId: ErrorId.SEND_TX,
                      msg: `Vultisig ${chainName} tx failed: ${error?.message ?? error.toString()}`
                    })
                  )
                ),
                RxOp.startWith(RD.pending)
              )
          )
        )
      )
    )
  }
}
