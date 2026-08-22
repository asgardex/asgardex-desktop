import * as RD from '@devexperts/remote-data-ts'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { abi, CompatibleAsset, getAllowance, getFee, isApproved } from '@xchainjs/xchain-evm'
import { Address, baseAmount, BaseAmount, Chain, getContractAddressFromAsset, TokenAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
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
} from '../../../../shared/api/io'
import { ApiUrls, LedgerError } from '../../../../shared/api/types'
import { DEFAULT_EVM_GAS_MULTIPLIER } from '../../../../shared/const'
import { applyGasMultiplier } from '../../../../shared/evm/gas'
import { getBlocktime } from '../../../../shared/evm/provider'
import { isError, isEvmHDMode, isLedgerWallet, isVultisigWallet } from '../../../../shared/utils/guard'
import { getEVMAssetAddress, isChainAsset, isEVMTokenAsset } from '../../../helpers/assetHelper'
import { eqAsset } from '../../../helpers/fp/eq'
import { sequenceSOption } from '../../../helpers/fpHelpers'
import { LiveData } from '../../../helpers/rx/liveData'
import { Network$ } from '../../app/types'
import { ChainTxFeeOption } from '../../chain/const'
import * as C from '../../clients'
import { ApiError, ErrorId, TxHashLD } from '../../wallet/types'
import { DEPOSIT_EXPIRATION_OFFSET, ERC20_OUT_TX_GAS_LIMIT, ETH_OUT_TX_GAS_LIMIT } from '../const'
import {
  ApproveParams,
  AllowanceLD,
  AllowanceParams,
  TransactionService,
  IsApprovedLD,
  SendPoolTxParams,
  IsApproveParams,
  SendTxParams,
  EvmTxParams,
  Client$,
  Client as EvmClient
} from '../types'
import { createVultisigEvmApprove, createVultisigEvmPoolTx, createVultisigEvmTx } from '../vultisigTx'

export type EvmTransactionConfig = {
  chain: Chain
  chainName: string
  apiKey?: string
  addressInWhitelist: (addr: Address) => boolean
  defaultGasLimit: number
  useEstimateGasLimit?: boolean
}

export const createEvmTransactionService = (
  config: EvmTransactionConfig,
  client$: Client$,
  network$: Network$,
  evmRpc$: Rx.Observable<ApiUrls>,
  gasMultiplier$: Rx.Observable<number> = Rx.of(DEFAULT_EVM_GAS_MULTIPLIER),
  readOnlyClient$: Client$ = client$
): TransactionService => {
  const { chain, chainName, apiKey, addressInWhitelist, defaultGasLimit, useEstimateGasLimit } = config
  const common = C.createTransactionService(client$)

  const runSendPoolTx$ = (client: EvmClient, { ...params }: SendPoolTxParams, gasMultiplier: number): TxHashLD => {
    const failure$ = (msg: string) =>
      Rx.of<RD.RemoteData<ApiError, never>>(
        RD.failure({
          errorId: ErrorId.POOL_TX,
          msg
        })
      )

    const provider = client.getProvider()

    return FP.pipe(
      sequenceSOption({ address: getEVMAssetAddress(params.asset), router: params.router }),
      O.fold(
        () => failure$(`Invalid values: Asset ${params.asset} / router address ${params.router}`),
        ({ router }): TxHashLD =>
          FP.pipe(
            Rx.forkJoin({
              gasPrices: Rx.from(client.estimateGasPrices()),
              blockTime: Rx.from(getBlocktime(provider))
            }),
            RxOp.switchMap(({ gasPrices: rawGasPrices, blockTime }) => {
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
                  if (useEstimateGasLimit) {
                    // ARB: estimate gas limit dynamically
                    const tx: EvmTxParams = {
                      asset: nativeAsset.asset,
                      amount: isERC20 ? baseAmount(0, nativeAsset.decimal) : params.amount,
                      memo: unsignedTx.data,
                      recipient: router,
                      gasPrice: gasPrices[params.feeOption],
                      isMemoEncoded: true,
                      walletIndex: params.walletIndex
                    }
                    return Rx.from(client.estimateGasLimit(tx)).pipe(
                      RxOp.catchError(() => Rx.of(new BigNumber(defaultGasLimit))),
                      RxOp.switchMap((gasLimit) =>
                        Rx.from(
                          client.transfer({
                            ...tx,
                            gasLimit
                          })
                        )
                      )
                    )
                  }
                  // Default: use fixed gas limit
                  return Rx.from(
                    client.transfer({
                      asset: nativeAsset.asset,
                      amount: isERC20 ? baseAmount(0, nativeAsset.decimal) : params.amount,
                      memo: unsignedTx.data,
                      recipient: router,
                      gasPrice: gasPrices[params.feeOption],
                      isMemoEncoded: true,
                      gasLimit: new BigNumber(defaultGasLimit),
                      walletIndex: params.walletIndex
                    })
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
      chain,
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
      apiKey,
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
                  msg: `Deposit Ledger ${chainName}/ERC20 tx failed. (${msg})`
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

    if (isVultisigWallet(params.walletType)) return sendVultisigPoolTx({ params })

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
    client: EvmClient,
    { walletIndex, contractAddress, spenderAddress, amount }: ApproveParams
  ): TxHashLD => {
    return FP.pipe(
      Rx.from(
        client.approve({
          contractAddress,
          spenderAddress,
          feeOption: ChainTxFeeOption.APPROVE,
          walletIndex,
          // omit amount → unlimited; explicit 0 → revoke; finite → limited approve
          ...(amount !== undefined ? { amount } : {})
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
    amount,
    evmRpcUrl
  }: ApproveParams & { evmRpcUrl: string }): TxHashLD => {
    if (!isEvmHDMode(hdMode)) {
      return Rx.of(
        RD.failure({
          errorId: ErrorId.APPROVE_LEDGER_TX,
          msg: `Invalid ${chainName}HDMode ${hdMode} - needed for Ledger to send ERC20 token.`
        })
      )
    }

    const ipcParams: IPCLedgerApproveERC20TokenParams = {
      chain,
      network,
      contractAddress,
      spenderAddress,
      walletAccount,
      walletIndex,
      hdMode,
      apiKey,
      evmRpcUrl,
      // Serialize as string across IPC; omit for unlimited
      amount: amount !== undefined ? amount.amount().toFixed() : undefined
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
    if (network === Network.Mainnet && !addressInWhitelist(contractAddress))
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

    if (isVultisigWallet(walletType)) return sendVultisigApprove(params)

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
    client: EvmClient,
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
    readOnlyClient$.pipe(
      RxOp.filter(O.isSome),
      RxOp.take(1),
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => runIsApprovedERC20Token$(client, params)
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )

  const runGetERC20Allowance$ = (
    client: EvmClient,
    { contractAddress, spenderAddress, fromAddress, decimals }: AllowanceParams
  ): AllowanceLD => {
    const provider = client.getProvider()

    return FP.pipe(
      Rx.from(getAllowance({ provider, contractAddress, spenderAddress, fromAddress })),
      RxOp.map((allowance) => RD.success(baseAmount(allowance.toFixed(), decimals))),
      RxOp.catchError(
        (error): AllowanceLD =>
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

  const getERC20Allowance$ = (params: AllowanceParams): AllowanceLD =>
    readOnlyClient$.pipe(
      RxOp.filter(O.isSome),
      RxOp.take(1),
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => runGetERC20Allowance$(client, params)
          )
        )
      ),
      RxOp.startWith(RD.pending)
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
      chain,
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
      apiKey,
      destinationTag: undefined,
      evmRpcUrl,
      gasMultiplier,
      sendMax: undefined
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
                  msg: `Sending Ledger ${chainName}/ERC20 tx failed. (${msg})`
                })
              ),
            (txHash) => Rx.of(RD.success(txHash))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  }

  /**
   * Keystore EVM send.
   *
   * Max in the UI is `balance − feeQuote`, but fee quotes can be stale or estimated with
   * dummy amount/recipient (`SendView`). Send used to re-call `estimateGasPrices()` and
   * let xchain re-estimate gasLimit — so the fee attached to the tx could exceed what Max
   * reserved → node "insufficient funds for gas * price + value" by dust.
   *
   * Fix for native sends:
   * 1. Fresh gasPrice (tier + multiplier)
   * 2. Estimate gasLimit for the current amount
   * 3. feeCap = gasPrice × gasLimit; reclamp amount to balance − feeCap
   * 4. Re-estimate gasLimit for the **final** amount and reclamp again if feeCap grew
   *    (amount can affect eth_estimateGas; one re-pass is enough for simple transfers)
   * 5. Pass pinned gasPrice + gasLimit into transfer so xchain does not re-quote
   *
   * Token sends leave amount alone (gas paid in native separately).
   */
  const runSendTx$ = (client: EvmClient, params: SendTxParams, gasMultiplier: number): TxHashLD => {
    const failure$ = (msg: string) =>
      Rx.of<RD.RemoteData<ApiError, never>>(
        RD.failure({
          errorId: ErrorId.SEND_TX,
          msg
        })
      )

    return FP.pipe(
      Rx.from(
        (async (): Promise<TxHash> => {
          const rawGasPrices = await client.estimateGasPrices()
          const gasPrices = applyGasMultiplier(rawGasPrices, gasMultiplier)
          const gasPrice = gasPrices[params.feeOption]
          const assetInfo = client.getAssetInfo()
          const isNative = isChainAsset(params.asset)
          const fallbackGasLimit = isNative ? ETH_OUT_TX_GAS_LIMIT : ERC20_OUT_TX_GAS_LIMIT

          let amount: BaseAmount = params.amount

          const estimateGasLimitFor = async (amt: BaseAmount, from?: string): Promise<BigNumber> => {
            try {
              return await client.estimateGasLimit({
                asset: params.asset as CompatibleAsset,
                amount: amt,
                recipient: params.recipient,
                memo: params.memo,
                from: from ?? params.sender
              })
            } catch {
              return fallbackGasLimit
            }
          }

          if (isNative) {
            const sender = await client.getAddressAsync(params.walletIndex)
            // Native-only: empty assets array skips EVM provider ERC-20 tokentx fan-out.
            type EvmGetBalance = (
              address: string,
              assets?: CompatibleAsset[]
            ) => Promise<{ asset: CompatibleAsset; amount: BaseAmount }[]>
            const balances = await (client.getBalance as EvmGetBalance)(sender, [])
            const nativeBal = balances.find((b) => eqAsset.equals(b.asset, assetInfo.asset))?.amount
            if (!nativeBal) {
              throw new Error('Unable to read native balance for send')
            }

            // Estimate gas for current amount → reclamp amount → re-estimate for final amount.
            // Cap at 3 passes. Keep the higher gasLimit so feeCap never under-covers.
            let gasLimit = await estimateGasLimitFor(amount, sender)
            for (let pass = 0; pass < 3; pass++) {
              const feeCap = getFee({
                gasPrice,
                gasLimit,
                decimals: assetInfo.decimal
              })
              const maxSendableBn = nativeBal.amount().minus(feeCap.amount())
              if (maxSendableBn.lte(0)) {
                throw new Error('Insufficient funds for gas')
              }
              const nextAmount = amount.amount().gt(maxSendableBn)
                ? baseAmount(maxSendableBn.integerValue(BigNumber.ROUND_FLOOR), amount.decimal)
                : amount

              const nextGasLimit = await estimateGasLimitFor(nextAmount, sender)
              const gasForCap = BigNumber.max(gasLimit, nextGasLimit)
              const amountUnchanged = nextAmount.amount().eq(amount.amount())
              const gasUnchanged = gasForCap.eq(gasLimit)

              amount = nextAmount
              gasLimit = gasForCap

              if (amountUnchanged && gasUnchanged) break
            }

            return client.transfer({
              asset: params.asset as CompatibleAsset,
              amount,
              recipient: params.recipient,
              memo: params.memo,
              gasPrice,
              gasLimit,
              walletIndex: params.walletIndex
            })
          }

          // Token (and other non-native) path: estimate once, pin gas, leave amount alone
          const gasLimit = await estimateGasLimitFor(amount)
          return client.transfer({
            asset: params.asset as CompatibleAsset,
            amount,
            recipient: params.recipient,
            memo: params.memo,
            gasPrice,
            gasLimit,
            walletIndex: params.walletIndex
          })
        })()
      ),
      RxOp.map(RD.success),
      RxOp.catchError((error): TxHashLD => failure$(error?.message ?? error.toString())),
      RxOp.startWith(RD.pending)
    )
  }

  // Vultisig transaction handlers - MPC signing
  // Use readOnlyClient$ (enhancedClient$) so pool/approve handlers work without keystore
  const sendVultisigTx = createVultisigEvmTx(readOnlyClient$, chain)
  const sendVultisigPoolTx = createVultisigEvmPoolTx(readOnlyClient$, chain)
  const sendVultisigApprove = createVultisigEvmApprove(readOnlyClient$, chain)

  const sendTx = (params: SendTxParams) =>
    FP.pipe(
      Rx.combineLatest([client$, network$, evmRpc$, gasMultiplier$]),
      RxOp.switchMap(([oClient, network, rpcUrls, gasMultiplier]) => {
        if (isLedgerWallet(params.walletType))
          return sendLedgerTx({ network, params, evmRpcUrl: rpcUrls[network], gasMultiplier })

        if (isVultisigWallet(params.walletType)) return sendVultisigTx({ network, params })

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
    isApprovedERC20Token$,
    getERC20Allowance$
  }
}
