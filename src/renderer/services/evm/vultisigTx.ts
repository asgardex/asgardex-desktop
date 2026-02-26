/**
 * Vultisig handlers for EVM chains
 *
 * - createVultisigEvmTx: SEND handler (simple transfers)
 *   Uses SDK native pipeline: prepareSendTx → extractMessageHashes → sign → broadcastTx
 *
 * - createVultisigEvmPoolTx: POOL/SWAP handler (router contract calls)
 *   ABI-encodes depositWithExpiry() calldata, then sends via SDK pipeline.
 *   The 0x-prefixed calldata is passed as memo, which the SDK places in the tx data field.
 *
 * - createVultisigEvmApprove: ERC20 APPROVE handler
 *   Passes approve params to IPC handler which ABI-encodes calldata as memo on native coin.
 */
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { abi, MAX_APPROVAL } from '@xchainjs/xchain-evm'
import { baseAmount, getContractAddressFromAsset, TokenAsset } from '@xchainjs/xchain-util'
import { Contract, getAddress, ZeroAddress } from 'ethers'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { SendTransactionParams } from '../../../shared/api/mpcTypes'
import { getBlocktime } from '../../../shared/evm/provider'
import { getEVMAssetAddress, isEVMTokenAsset } from '../../helpers/assetHelper'
import { sequenceSOption } from '../../helpers/fpHelpers'
import { appWalletService } from '../wallet/appWallet'
import { ApiError, ErrorId, TxHashLD } from '../wallet/types'
import { DEPOSIT_EXPIRATION_OFFSET } from './const'
import { ApproveParams, Client$, SendPoolTxParams, SendTxParams } from './types'

/**
 * Creates a Vultisig send handler for EVM chains
 *
 * @param client$ - EVM chain client (unused for send — SDK native pipeline handles everything)
 * @param chainName - Chain identifier (e.g., 'ETH', 'BSC', 'AVAX', 'ARB', 'BASE')
 */
export const createVultisigEvmTx = (
  client$: Client$,
  chainName: string
): (({ network, params }: { network: Network; params: SendTxParams }) => TxHashLD) => {
  // Suppress unused warning — client$ kept for API consistency with keystore/ledger handlers
  void client$

  return ({ params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const { asset, recipient, amount, memo } = params

    const vaultId = appWalletService.getActiveVaultId()
    if (!vaultId) {
      window.apiLog.error('[Vultisig]', `${chainName} tx failed: no active vault`)
      return Rx.of(RD.failure({ errorId: ErrorId.SEND_TX, msg: 'No active Vultisig vault' }))
    }

    // Native gas tokens get no id; ERC20 tokens get their contract address (with 0x prefix for SDK/viem)
    const id = isEVMTokenAsset(asset as TokenAsset)
      ? `0x${getContractAddressFromAsset(asset as TokenAsset)}`
      : undefined

    const txParams: SendTransactionParams = {
      vaultId,
      chain: chainName,
      receiver: recipient,
      amount: amount.amount().toFixed(),
      memo,
      decimals: amount.decimal,
      ticker: asset.ticker,
      id
    }

    window.apiLog.info('[Vultisig]', `${chainName} sendTransaction via SDK pipeline`, {
      receiver: recipient,
      amount: amount.amount().toString(),
      memo: memo || '(none)',
      vaultId,
      ticker: asset.ticker,
      id: id || '(native)'
    })

    return Rx.from(window.apiMpc.sendTransaction(txParams)).pipe(
      RxOp.map(({ txHash }) => {
        window.apiLog.info('[Vultisig]', `${chainName} tx success`, { txHash })
        return RD.success(txHash)
      }),
      RxOp.catchError((error) => {
        const errorMsg = error?.message ?? error.toString()

        if (errorMsg.includes('Signing cancelled')) {
          window.apiLog.info('[Vultisig]', `${chainName} tx cancelled by user`)
          return Rx.of(RD.initial)
        }

        window.apiLog.error('[Vultisig]', `${chainName} tx failed`, { error: errorMsg })
        return Rx.of(
          RD.failure({
            errorId: ErrorId.SEND_TX,
            msg: `Vultisig ${chainName} tx failed: ${errorMsg}`
          })
        )
      }),
      RxOp.startWith(RD.pending)
    )
  }
}

/**
 * Creates a Vultisig pool/swap handler for EVM chains.
 *
 * Replicates the keystore runSendPoolTx$ pattern: ABI-encodes depositWithExpiry()
 * calldata, then sends the 0x-prefixed calldata as memo via the SDK pipeline.
 * The SDK treats 0x-prefixed memos as raw tx data (contract calls).
 *
 * @param client$ - EVM chain client (needed for provider/blocktime and asset info)
 * @param chainName - Chain identifier (e.g., 'ETH', 'BSC', 'AVAX', 'ARB', 'BASE')
 */
export const createVultisigEvmPoolTx = (
  client$: Client$,
  chainName: string
): (({ params }: { params: SendPoolTxParams }) => TxHashLD) => {
  return ({ params }: { params: SendPoolTxParams }): TxHashLD => {
    const failure$ = (msg: string) =>
      Rx.of<RD.RemoteData<ApiError, never>>(
        RD.failure({
          errorId: ErrorId.POOL_TX,
          msg
        })
      )

    const vaultId = appWalletService.getActiveVaultId()
    if (!vaultId) {
      window.apiLog.error('[Vultisig]', `${chainName} pool tx failed: no active vault`)
      return Rx.of(RD.failure({ errorId: ErrorId.POOL_TX, msg: 'No active Vultisig vault' }))
    }

    return FP.pipe(
      sequenceSOption({ address: getEVMAssetAddress(params.asset), router: params.router }),
      O.fold(
        () => failure$(`Invalid values: Asset ${params.asset} / router address ${params.router}`),
        ({ router }): TxHashLD =>
          FP.pipe(
            client$,
            RxOp.switchMap((oClient) =>
              FP.pipe(
                oClient,
                O.fold(
                  () => Rx.of(RD.initial),
                  (client): TxHashLD => {
                    const provider = client.getProvider()
                    const nativeAsset = client.getAssetInfo()

                    return FP.pipe(
                      Rx.from(getBlocktime(provider)),
                      RxOp.switchMap((blockTime) => {
                        const isERC20 = isEVMTokenAsset(params.asset as TokenAsset)
                        const checkSummedContractAddress = isERC20
                          ? getAddress(getContractAddressFromAsset(params.asset as TokenAsset))
                          : ZeroAddress

                        const expiration = blockTime + DEPOSIT_EXPIRATION_OFFSET
                        const depositParams = [
                          params.recipient,
                          checkSummedContractAddress,
                          params.amount.amount().toFixed(),
                          params.memo,
                          expiration
                        ]

                        const routerContract = new Contract(router, abi.router)

                        return Rx.from(
                          routerContract.getFunction('depositWithExpiry').populateTransaction(...depositParams)
                        ).pipe(
                          RxOp.switchMap((unsignedTx) => {
                            // For native swaps, send the actual amount. For ERC20, amount is in calldata so send 0.
                            const sendAmount = isERC20
                              ? baseAmount(0, nativeAsset.decimal).amount().toFixed()
                              : params.amount.amount().toFixed()

                            const txParams: SendTransactionParams = {
                              vaultId: vaultId!,
                              chain: chainName,
                              receiver: router,
                              amount: sendAmount,
                              memo: unsignedTx.data, // 0x-prefixed calldata → SDK puts in tx data field
                              decimals: nativeAsset.decimal,
                              ticker: nativeAsset.asset.ticker
                            }

                            window.apiLog.info(
                              '[Vultisig]',
                              `${chainName} pool tx (depositWithExpiry) via SDK pipeline`,
                              {
                                router,
                                recipient: params.recipient,
                                amount: params.amount.amount().toString(),
                                sendAmount,
                                isERC20,
                                memo: params.memo || '(none)',
                                calldataLength: unsignedTx.data?.length ?? 0,
                                vaultId
                              }
                            )

                            return Rx.from(window.apiMpc.sendTransaction(txParams)).pipe(
                              RxOp.map(({ txHash }) => {
                                window.apiLog.info('[Vultisig]', `${chainName} pool tx success`, { txHash })
                                return RD.success(txHash)
                              })
                            )
                          })
                        )
                      }),
                      RxOp.catchError((error) => {
                        const errorMsg = error?.message ?? error.toString()
                        if (errorMsg.includes('Signing cancelled')) {
                          window.apiLog.info('[Vultisig]', `${chainName} pool tx cancelled by user`)
                          return Rx.of(RD.initial)
                        }
                        window.apiLog.error('[Vultisig]', `${chainName} pool tx failed`, { error: errorMsg })
                        return Rx.of(
                          RD.failure({
                            errorId: ErrorId.POOL_TX,
                            msg: `Vultisig ${chainName} pool tx failed: ${errorMsg}`
                          })
                        )
                      }),
                      RxOp.startWith(RD.pending)
                    )
                  }
                )
              )
            )
          )
      )
    )
  }
}

/**
 * Creates a Vultisig ERC20 approve handler for EVM chains.
 *
 * Passes approve params to the IPC handler which ABI-encodes the calldata,
 * uses a native coin so the EVM resolver puts it in tx data, and overrides
 * the amount to 0 after validation (approve is non-payable).
 *
 * @param client$ - EVM chain client (needed for native asset ticker/decimals)
 * @param chainName - Chain identifier (e.g., 'ETH', 'BSC', 'AVAX', 'ARB', 'BASE')
 */
export const createVultisigEvmApprove = (
  client$: Client$,
  chainName: string
): ((params: ApproveParams) => TxHashLD) => {
  return (params: ApproveParams): TxHashLD => {
    const { contractAddress, spenderAddress } = params

    const vaultId = appWalletService.getActiveVaultId()
    if (!vaultId) {
      window.apiLog.error('[Vultisig]', `${chainName} approve failed: no active vault`)
      return Rx.of(RD.failure({ errorId: ErrorId.APPROVE_TX, msg: 'No active Vultisig vault' }))
    }

    return FP.pipe(
      client$,
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client): TxHashLD => {
              const nativeAsset = client.getAssetInfo()

              // Native coin (no id) — the IPC handler ABI-encodes the approve calldata
              // and puts it in memo, which the EVM resolver uses as tx data.
              const txParams: SendTransactionParams = {
                vaultId,
                chain: chainName,
                receiver: contractAddress,
                amount: '0', // IPC handler overrides to 1 for validation, then back to 0
                decimals: nativeAsset.decimal,
                ticker: nativeAsset.asset.ticker,
                approve: { spender: spenderAddress, amount: MAX_APPROVAL.toFixed() }
              }

              window.apiLog.info('[Vultisig]', `${chainName} ERC20 approve via native calldata`, {
                contractAddress,
                spenderAddress,
                vaultId
              })

              return Rx.from(window.apiMpc.sendTransaction(txParams)).pipe(
                RxOp.map(({ txHash }) => {
                  window.apiLog.info('[Vultisig]', `${chainName} approve success`, { txHash })
                  return RD.success(txHash)
                }),
                RxOp.catchError((error) => {
                  const errorMsg = error?.message ?? error.toString()
                  if (errorMsg.includes('Signing cancelled')) {
                    window.apiLog.info('[Vultisig]', `${chainName} approve cancelled by user`)
                    return Rx.of(RD.initial)
                  }
                  window.apiLog.error('[Vultisig]', `${chainName} approve failed`, { error: errorMsg })
                  return Rx.of(
                    RD.failure({
                      errorId: ErrorId.APPROVE_TX,
                      msg: `Vultisig ${chainName} approve failed: ${errorMsg}`
                    })
                  )
                }),
                RxOp.startWith(RD.pending)
              )
            }
          )
        )
      )
    )
  }
}
