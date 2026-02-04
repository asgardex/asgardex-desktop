import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { abi, CompatibleAsset, isApproved } from '@xchainjs/xchain-evm'
import { baseAmount, getContractAddressFromAsset, TokenAsset } from '@xchainjs/xchain-util'
import { Contract, getAddress, ZeroAddress } from 'ethers'
import { either as E, function as FP, option as O } from 'fp-ts'
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
import { ApiUrls, LedgerError } from '../../../shared/api/types'
import { DEFAULT_EVM_GAS_MULTIPLIER } from '../../../shared/const'
import { applyGasMultiplier } from '../../../shared/evm/gas'
import { getBlocktime } from '../../../shared/evm/provider'
import { isError, isEvmHDMode, isLedgerWallet } from '../../../shared/utils/guard'
import { addressInArbWhitelist, getEVMAssetAddress, isEVMTokenAsset } from '../../helpers/assetHelper'
import { sequenceSOption } from '../../helpers/fpHelpers'
import { LiveData } from '../../helpers/rx/liveData'
import { Network$ } from '../app/types'
import { ChainTxFeeOption } from '../chain/const'
import * as C from '../clients'
import { DEPOSIT_EXPIRATION_OFFSET } from '../evm/const'
import {
  ApproveParams,
  TransactionService,
  IsApprovedLD,
  SendPoolTxParams,
  IsApproveParams,
  SendTxParams,
  EvmTxParams,
  Client$,
  Client as ArbClient
} from '../evm/types'
import { ApiError, ErrorId, TxHashLD } from '../wallet/types'

export const createTransactionService = (
  client$: Client$,
  network$: Network$,
  evmRpc$: Rx.Observable<ApiUrls>,
  gasMultiplier$: Rx.Observable<number> = Rx.of(DEFAULT_EVM_GAS_MULTIPLIER)
): TransactionService => {
  const common = C.createTransactionService(client$)

  // Note: We don't use `client.deposit` to send "pool" txs to avoid repeating same requests we already do in ASGARDEX
  // That's why we call `deposit` directly here
  const runSendPoolTx$ = (client: ArbClient, { ...params }: SendPoolTxParams, gasMultiplier: number): TxHashLD => {
    // helper for failures
    const failure$ = (msg: string) =>
      Rx.of<RD.RemoteData<ApiError, never>>(
        RD.failure({
          errorId: ErrorId.POOL_TX,
          msg
        })
      )

    return FP.pipe(
      sequenceSOption({ address: getEVMAssetAddress(params.asset), router: params.router }),
      O.fold(
        () => failure$(`Invalid values: Asset ${params.asset} / router address ${params.router}`),
        ({ router }): TxHashLD =>
          FP.pipe(
            Rx.forkJoin({
              gasPrices: Rx.from(client.estimateGasPrices()),
              blockTime: Rx.from(getBlocktime(client.getProvider()))
            }),
            RxOp.switchMap(({ gasPrices: rawGasPrices, blockTime }) => {
              // Apply gas multiplier to increase fees if configured
              const gasPrices = applyGasMultiplier(rawGasPrices, gasMultiplier)
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
              const nativeAsset = client.getAssetInfo()

              return Rx.from(
                routerContract.getFunction('depositWithExpiry').populateTransaction(...depositParams)
              ).pipe(
                RxOp.switchMap((unsignedTx) => {
                  const tx: EvmTxParams = {
                    asset: nativeAsset.asset,
                    amount: isERC20 ? baseAmount(0, nativeAsset.decimal) : params.amount,
                    memo: unsignedTx.data,
                    recipient: router,
                    gasPrice: gasPrices[params.feeOption],
                    isMemoEncoded: true
                  }

                  // Estimate gas and return the transfer transaction as an observable
                  return Rx.from(client.estimateGasLimit(tx)).pipe(
                    RxOp.switchMap((gasLimit) =>
                      Rx.from(
                        client.transfer({
                          ...tx,
                          gasLimit
                        })
                      )
                    )
                  )
                })
              )
            }),
            RxOp.map((txResult) => txResult),
            RxOp.map(RD.success),
            RxOp.catchError((error): TxHashLD => failure$(error?.message ?? error.toString())),
            RxOp.startWith(RD.pending)
          )
      )
    )
  }

  const sendLedgerPoolTx = ({
    network,
    params,
    evmRpcUrl,
    gasMultiplier
  }: {
    network: Network
    params: SendPoolTxParams
    evmRpcUrl: string
    gasMultiplier: number
  }): TxHashLD => {
    const ipcParams: IPCLedgerDepositTxParams = {
      chain: ARBChain,
      network,
      asset: params.asset,
      router: O.toUndefined(params.router),
      amount: params.amount,
      memo: params.memo,
      recipient: params.recipient,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      feeOption: params.feeOption,
      nodeUrl: undefined,
      hdMode: params.hdMode,
      apiKey: undefined,
      evmRpcUrl,
      gasMultiplier
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
                  msg: `Deposit Ledger Arb/ERC20 tx failed. (${msg})`
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
        Rx.combineLatest([network$, evmRpc$, gasMultiplier$]),
        RxOp.switchMap(([network, rpcUrls, gasMultiplier]) =>
          sendLedgerPoolTx({ network, params, evmRpcUrl: rpcUrls[network], gasMultiplier })
        )
      )

    return FP.pipe(
      Rx.combineLatest([client$, gasMultiplier$]),
      RxOp.switchMap(([oClient, gasMultiplier]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => runSendPoolTx$(client, params, gasMultiplier)
          )
        )
      )
    )
  }

  const runApproveERC20Token$ = (
    client: ArbClient,
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
    hdMode,
    evmRpcUrl
  }: ApproveParams & { evmRpcUrl: string }): TxHashLD => {
    if (!isEvmHDMode(hdMode)) {
      return Rx.of(
        RD.failure({
          errorId: ErrorId.APPROVE_LEDGER_TX,
          msg: `Invalid ArbHDMode ${hdMode} - needed for Ledger to send ERC20 token.`
        })
      )
    }

    const ipcParams: IPCLedgerApproveERC20TokenParams = {
      chain: ARBChain,
      network,
      contractAddress,
      spenderAddress,
      walletAccount,
      walletIndex,
      hdMode,
      apiKey: undefined,
      evmRpcUrl
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
                  msg: `Approve Ledger ERC20 token failed. (${msg})`
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
            msg: `Approve Ledger ERC20 token failed. ${
              isError(error) ? (error?.message ?? error.toString()) : error.toString()
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
    if (network === Network.Mainnet && !addressInArbWhitelist(contractAddress))
      return Rx.of(
        RD.failure({
          msg: `Contract address ${contractAddress} is black listed`,
          errorId: ErrorId.APPROVE_TX
        })
      )

    if (isLedgerWallet(walletType))
      return FP.pipe(
        evmRpc$,
        RxOp.switchMap((rpcUrls) => runApproveLedgerERC20Token$({ ...params, evmRpcUrl: rpcUrls[network] }))
      )

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
    client: ArbClient,
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

  const sendLedgerTx = ({
    network,
    params,
    evmRpcUrl,
    gasMultiplier
  }: {
    network: Network
    params: SendTxParams
    evmRpcUrl: string
    gasMultiplier: number
  }): TxHashLD => {
    const ipcParams: IPCLedgerSendTxParams = {
      chain: ARBChain,
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
      hdMode: params.hdMode,
      apiKey: undefined,
      destinationTag: undefined,
      evmRpcUrl,
      gasMultiplier
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

  // Keystore send with gas multiplier applied
  const runSendTx$ = (client: ArbClient, params: SendTxParams, gasMultiplier: number): TxHashLD => {
    const failure$ = (msg: string) =>
      Rx.of<RD.RemoteData<ApiError, never>>(
        RD.failure({
          errorId: ErrorId.SEND_TX,
          msg
        })
      )

    return FP.pipe(
      Rx.from(client.estimateGasPrices()),
      RxOp.switchMap((rawGasPrices) => {
        // Apply gas multiplier to increase fees if configured
        const gasPrices = applyGasMultiplier(rawGasPrices, gasMultiplier)

        return Rx.from(
          client.transfer({
            asset: params.asset as CompatibleAsset,
            amount: params.amount,
            recipient: params.recipient,
            memo: params.memo,
            gasPrice: gasPrices[params.feeOption],
            walletIndex: params.walletIndex
          })
        )
      }),
      RxOp.map(RD.success),
      RxOp.catchError((error): TxHashLD => failure$(error?.message ?? error.toString())),
      RxOp.startWith(RD.pending)
    )
  }

  const sendTx = (params: SendTxParams) =>
    FP.pipe(
      Rx.combineLatest([client$, network$, evmRpc$, gasMultiplier$]),
      RxOp.switchMap(([oClient, network, rpcUrls, gasMultiplier]) => {
        if (isLedgerWallet(params.walletType))
          return sendLedgerTx({ network, params, evmRpcUrl: rpcUrls[network], gasMultiplier })

        // For keystore mode, apply gas multiplier
        return FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => runSendTx$(client, params, gasMultiplier)
          )
        )
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
