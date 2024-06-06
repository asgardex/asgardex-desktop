import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { isApproved } from '@xchainjs/xchain-evm'
import { baseAmount } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as E from 'fp-ts/lib/Either'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import {
  IPCLedgerApproveERC20TokenParams,
  ipcLedgerApproveERC20TokenParamsIO,
  IPCLedgerDepositTxParams,
  ipcLedgerDepositTxParamsIO,
  IPCLedgerSendTxParams,
  ipcLedgerSendTxParamsIO
} from '../../../shared/api/io'
import { LedgerError } from '../../../shared/api/types'
import { DEPOSIT_EXPIRATION_OFFSET, ETHAddress } from '../../../shared/ethereum/const'
import { ROUTER_ABI } from '../../../shared/evm/abi'
import { getBlocktime } from '../../../shared/evm/provider'
import { isError, isEvmHDMode, isLedgerWallet } from '../../../shared/utils/guard'
import { addressInERC20Whitelist, getEthAssetAddress } from '../../helpers/assetHelper'
import { sequenceSOption } from '../../helpers/fpHelpers'
import { LiveData } from '../../helpers/rx/liveData'
import { Network$ } from '../app/types'
import { ChainTxFeeOption } from '../chain/const'
import * as C from '../clients'
import {
  ApproveParams,
  TransactionService,
  IsApprovedLD,
  SendPoolTxParams,
  IsApproveParams,
  SendTxParams
} from '../evm/types'
import { ApiError, ErrorId, TxHashLD } from '../wallet/types'
import { Client$, Client as EthClient } from './types'

export const createTransactionService = (client$: Client$, network$: Network$): TransactionService => {
  const common = C.createTransactionService(client$)

  // Note: We don't use `client.deposit` to send "pool" txs to avoid repeating same requests we already do in ASGARDEX
  // That's why we call `deposit` directly here
  const runSendPoolTx$ = (client: EthClient, { ...params }: SendPoolTxParams): TxHashLD => {
    // helper for failures
    const failure$ = (msg: string) =>
      Rx.of<RD.RemoteData<ApiError, never>>(
        RD.failure({
          errorId: ErrorId.POOL_TX,
          msg
        })
      )

    const provider = client.getProvider()

    return FP.pipe(
      sequenceSOption({ address: getEthAssetAddress(params.asset), router: params.router }),
      O.fold(
        () => failure$(`Invalid values: Asset ${params.asset} / router address ${params.router}`),
        ({ address, router }) =>
          FP.pipe(
            Rx.forkJoin({
              gasPrices: Rx.from(client.estimateGasPrices()),
              blockTime: Rx.from(getBlocktime(provider))
            }),
            RxOp.switchMap(({ gasPrices, blockTime }) => {
              const isETHAddress = address === ETHAddress
              const amount = isETHAddress ? baseAmount(0) : params.amount
              const gasPrice = gasPrices[params.feeOption].amount().toFixed(0) // no round down needed
              const signer = client.getWallet(params.walletIndex)
              const expiration = blockTime + DEPOSIT_EXPIRATION_OFFSET
              return Rx.from(
                // Call deposit function of Router contract
                // Note:
                // Amounts need to use `toFixed` to convert `BaseAmount` to `Bignumber`
                // since `value` and `gasPrice` type is `Bignumber`
                client.call<{ hash: TxHash }>({
                  signer,
                  contractAddress: router,
                  abi: ROUTER_ABI,
                  funcName: 'depositWithExpiry',
                  funcParams: [
                    params.recipient,
                    address,
                    // Send `BaseAmount` w/o decimal and always round down for currencies
                    amount.amount().toFixed(0, BigNumber.ROUND_DOWN),
                    params.memo,
                    expiration,
                    isETHAddress
                      ? {
                          // Send `BaseAmount` w/o decimal and always round down for currencies
                          value: params.amount.amount().toFixed(0, BigNumber.ROUND_DOWN),
                          gasPrice
                        }
                      : { gasPrice }
                  ]
                })
              )
            }),
            RxOp.map((txResult) => txResult.hash),
            RxOp.map(RD.success),
            RxOp.catchError((error): TxHashLD => failure$(error?.message ?? error.toString())),
            RxOp.startWith(RD.pending)
          )
      )
    )
  }

  const sendLedgerPoolTx = ({ network, params }: { network: Network; params: SendPoolTxParams }): TxHashLD => {
    const ipcParams: IPCLedgerDepositTxParams = {
      chain: ETHChain,
      network,
      asset: params.asset,
      amount: params.amount,
      router: O.toUndefined(params.router),
      recipient: params.recipient,
      memo: params.memo,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      feeOption: params.feeOption,
      nodeUrl: undefined,
      hdMode: params.hdMode
    }
    const encoded = ipcLedgerDepositTxParamsIO.encode(ipcParams)
    return FP.pipe(
      Rx.from(window.apiHDWallet.depositLedgerTx(encoded)),
      RxOp.switchMap(
        FP.flow(
          E.fold<LedgerError, TxHash, TxHashLD>(
            ({ msg }) =>
              Rx.of(
                RD.failure({
                  errorId: ErrorId.DEPOSIT_LEDGER_TX_ERROR,
                  msg: `Deposit Ledger ETH/ERC20 tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  const sendPoolTx$ = (params: SendPoolTxParams): TxHashLD => {
    if (isLedgerWallet(params.walletType))
      return FP.pipe(
        network$,
        RxOp.switchMap((network) => sendLedgerPoolTx({ network, params }))
      )

    return FP.pipe(
      client$,
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => runSendPoolTx$(client, params)
          )
        )
      )
    )
  }

  const runApproveERC20Token$ = (
    client: EthClient,
    { walletIndex, contractAddress, spenderAddress }: ApproveParams
  ): TxHashLD => {
    // send approve tx
    return FP.pipe(
      Rx.from(
        client.approve({
          contractAddress,
          spenderAddress,
          feeOption: ChainTxFeeOption.APPROVE,
          walletIndex
        })
      ),
      RxOp.switchMap((txResult) => Rx.from(txResult)),
      RxOp.map(RD.success),
      RxOp.catchError(
        (error): TxHashLD =>
          Rx.of(
            RD.failure({
              msg: error?.message ?? error.toString(),
              errorId: ErrorId.APPROVE_TX
            })
          )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  const runApproveLedgerERC20Token$ = ({
    network,
    contractAddress,
    spenderAddress,
    walletAccount,
    walletIndex,
    hdMode
  }: ApproveParams): TxHashLD => {
    if (!isEvmHDMode(hdMode)) {
      return Rx.of(
        RD.failure({
          errorId: ErrorId.APPROVE_LEDGER_TX,
          msg: `Invalid EthHDMode ${hdMode} - needed for Ledger to send ERC20 token.`
        })
      )
    }

    const ipcParams: IPCLedgerApproveERC20TokenParams = {
      chain: ETHChain,
      network,
      contractAddress,
      spenderAddress,
      walletAccount,
      walletIndex,
      hdMode
    }
    const encoded = ipcLedgerApproveERC20TokenParamsIO.encode(ipcParams)
    return FP.pipe(
      Rx.from(window.apiHDWallet.approveLedgerERC20Token(encoded)),
      RxOp.switchMap(
        FP.flow(
          E.fold<LedgerError, TxHash, TxHashLD>(
            ({ msg }) =>
              Rx.of(
                RD.failure({
                  errorId: ErrorId.APPROVE_LEDGER_TX,
                  msg: `Approve Ledger ERC20 token failed: (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.catchError((error) =>
        Rx.of(
          RD.failure({
            errorId: ErrorId.APPROVE_LEDGER_TX,
            msg: `Approve Ledger ERC20 token failed here. ${
              isError(error) ? error?.message ?? error.toString() : error.toString()
            }`
          })
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  const approveERC20Token$ = (params: ApproveParams): TxHashLD => {
    const { contractAddress, network, walletType } = params
    // check contract address before approving
    if (network === Network.Mainnet && !addressInERC20Whitelist(contractAddress))
      return Rx.of(
        RD.failure({
          msg: `Contract address ${contractAddress} is black listed`,
          errorId: ErrorId.APPROVE_TX
        })
      )

    if (isLedgerWallet(walletType)) return runApproveLedgerERC20Token$(params)

    return client$.pipe(
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => runApproveERC20Token$(client, params)
          )
        )
      )
    )
  }

  const runIsApprovedERC20Token$ = (
    client: EthClient,
    { contractAddress, spenderAddress, fromAddress }: IsApproveParams
  ): LiveData<ApiError, boolean> => {
    const provider = client.getProvider()

    return FP.pipe(
      Rx.from(isApproved({ provider, contractAddress, spenderAddress, fromAddress })),
      RxOp.map(RD.success),
      RxOp.catchError(
        (error): LiveData<ApiError, boolean> =>
          Rx.of(
            RD.failure({
              msg: error?.message ?? error.toString(),
              errorId: ErrorId.APPROVE_TX
            })
          )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  const isApprovedERC20Token$ = (params: IsApproveParams): IsApprovedLD =>
    client$.pipe(
      RxOp.debounceTime(300),
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => runIsApprovedERC20Token$(client, params)
          )
        )
      )
    )

  const sendLedgerTx = ({ network, params }: { network: Network; params: SendTxParams }): TxHashLD => {
    const ipcParams: IPCLedgerSendTxParams = {
      chain: ETHChain,
      network,
      asset: params.asset,
      feeAsset: undefined,
      amount: params.amount,
      sender: params.sender,
      recipient: params.recipient,
      memo: params.memo,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      feeRate: NaN,
      feeOption: params.feeOption,
      feeAmount: undefined,
      nodeUrl: undefined,
      hdMode: params.hdMode
    }

    const encoded = ipcLedgerSendTxParamsIO.encode(ipcParams)

    return FP.pipe(
      Rx.from(window.apiHDWallet.sendLedgerTx(encoded)),
      RxOp.switchMap(
        FP.flow(
          E.fold<LedgerError, TxHash, TxHashLD>(
            ({ msg }) =>
              Rx.of(
                RD.failure({
                  errorId: ErrorId.SEND_LEDGER_TX,
                  msg: `Sending Ledger ETH/ERC20 tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  const sendTx = (params: SendTxParams) =>
    FP.pipe(
      network$,
      RxOp.switchMap((network) => {
        if (isLedgerWallet(params.walletType)) return sendLedgerTx({ network, params })

        return common.sendTx(params)
      })
    )

  return {
    ...common,
    sendTx,
    sendPoolTx$,
    approveERC20Token$,
    isApprovedERC20Token$
  }
}
