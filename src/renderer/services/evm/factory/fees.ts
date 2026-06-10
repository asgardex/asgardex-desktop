import * as RD from '@devexperts/remote-data-ts'
import { Fees, FeeType } from '@xchainjs/xchain-client'
import { getFee, GasPrices, Client, CompatibleAsset } from '@xchainjs/xchain-evm'
import { AnyAsset, Asset, Chain } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { DEFAULT_EVM_GAS_MULTIPLIER } from '../../../../shared/const'
import { applyGasMultiplier } from '../../../../shared/evm/gas'
import { logger } from '../../../helpers/logger'
import { observableState } from '../../../helpers/stateHelper'
import { getChainGasPrices$ } from '../../chain/fees/nodeapi'
import type { FeeLD } from '../../chain/types'
import type { FeesLD } from '../../clients'
import { ERC20_OUT_TX_GAS_LIMIT, ETH_OUT_TX_GAS_LIMIT } from '../const'
import { FeesService, PoolInTxFeeParams, ApproveFeeHandler, ApproveParams, TxParams, Client$ } from '../types'

export type EvmFeesConfig = {
  chain: Chain
  gasAssetDecimal: number
  isChainAsset: (asset: AnyAsset) => boolean
  initialReloadFeesParams?: TxParams
}

export const createEvmFeesService = (
  config: EvmFeesConfig,
  client$: Client$,
  gasMultiplier$: Rx.Observable<number> = Rx.of(DEFAULT_EVM_GAS_MULTIPLIER)
): FeesService => {
  const { chain, gasAssetDecimal, isChainAsset, initialReloadFeesParams } = config

  const { get$: reloadFees$, set: reloadFees } = observableState<TxParams | undefined>(initialReloadFeesParams)

  const fees$ = (params: TxParams): FeesLD =>
    Rx.combineLatest([reloadFees$, client$, gasMultiplier$]).pipe(
      RxOp.switchMap(([reloadFeesParams, oClient, gasMultiplier]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.EMPTY,
            (client) => Rx.from(estimateAndCalculateFees(client, reloadFeesParams ?? params, gasMultiplier))
          )
        )
      ),
      RxOp.map(RD.success),
      RxOp.catchError((error) => Rx.of(RD.failure(error))),
      RxOp.startWith(RD.pending)
    )

  async function estimateAndCalculateFees(client: Client, params: TxParams, gasMultiplier: number) {
    const rawGasPrices = await client.estimateGasPrices()
    const gasPrices = applyGasMultiplier(rawGasPrices, gasMultiplier)
    const { fast: fastGP, fastest: fastestGP, average: averageGP } = gasPrices

    let gasLimit: BigNumber
    try {
      gasLimit = await client.estimateGasLimit({
        from: params.from,
        asset: params.asset as Asset,
        amount: params.amount,
        recipient: params.recipient,
        memo: params.memo
      })
    } catch (error) {
      if (params.asset && isChainAsset(params.asset as Asset)) {
        gasLimit = new BigNumber(ETH_OUT_TX_GAS_LIMIT)
      } else {
        gasLimit = new BigNumber(ERC20_OUT_TX_GAS_LIMIT)
      }
    }

    const fees: Fees = {
      type: FeeType.PerByte,
      average: getFee({ gasPrice: averageGP, gasLimit, decimals: gasAssetDecimal }),
      fast: getFee({ gasPrice: fastGP, gasLimit, decimals: gasAssetDecimal }),
      fastest: getFee({ gasPrice: fastestGP, gasLimit, decimals: gasAssetDecimal })
    }
    return fees
  }

  const poolInTxFees$ = (params: PoolInTxFeeParams): FeesLD =>
    Rx.combineLatest([client$, gasMultiplier$]).pipe(
      RxOp.switchMap(([oClient, gasMultiplier]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client): FeesLD => {
              const gasLimit$ = Rx.from(
                client.estimateGasLimit({
                  asset: params.asset as CompatibleAsset,
                  amount: params.amount,
                  recipient: params.recipient,
                  memo: params.memo
                })
              ).pipe(
                RxOp.catchError((error) => {
                  logger.debug('Gas limit estimation failed, using fallback:', error)
                  const fallbackGasLimit =
                    params.asset && isChainAsset(params.asset as Asset)
                      ? new BigNumber(ETH_OUT_TX_GAS_LIMIT)
                      : new BigNumber(ERC20_OUT_TX_GAS_LIMIT)
                  return Rx.of(fallbackGasLimit)
                })
              )

              const gasPrices$: Rx.Observable<RD.RemoteData<Error, GasPrices>> = FP.pipe(
                getChainGasPrices$(chain, gasAssetDecimal),
                RxOp.map((rd) =>
                  RD.isFailure(rd) ? RD.failure(new Error(String(rd.error))) : (rd as RD.RemoteData<Error, GasPrices>)
                ),
                RxOp.catchError(() =>
                  Rx.from(client.estimateGasPrices()).pipe(
                    RxOp.map(RD.success),
                    RxOp.catchError((error) => Rx.of(RD.failure(new Error(String(error)))))
                  )
                )
              )

              return Rx.combineLatest([gasLimit$, gasPrices$]).pipe(
                RxOp.switchMap(([gasLimit, gasPricesRD]) =>
                  FP.pipe(
                    gasPricesRD,
                    RD.fold<Error, GasPrices, FeesLD>(
                      () => Rx.of(RD.initial),
                      () => Rx.of(RD.pending),
                      (error) => Rx.of(RD.failure(error)),
                      (rawGasPrices) => {
                        const gasPrices = applyGasMultiplier(rawGasPrices, gasMultiplier)
                        return Rx.of(
                          RD.success({
                            type: FeeType.PerByte,
                            average: getFee({ gasPrice: gasPrices.average, gasLimit, decimals: gasAssetDecimal }),
                            fast: getFee({ gasPrice: gasPrices.fast, gasLimit, decimals: gasAssetDecimal }),
                            fastest: getFee({ gasPrice: gasPrices.fastest, gasLimit, decimals: gasAssetDecimal })
                          })
                        )
                      }
                    )
                  )
                ),
                RxOp.startWith(RD.pending)
              )
            }
          )
        )
      )
    )

  const approveTxFee$ = ({ spenderAddress, contractAddress, fromAddress }: ApproveParams): FeeLD =>
    Rx.combineLatest([client$, gasMultiplier$]).pipe(
      RxOp.switchMap(([oClient, gasMultiplier]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client): FeeLD =>
              Rx.combineLatest([
                client.estimateApprove({ contractAddress, spenderAddress, fromAddress }),
                client.estimateGasPrices()
              ]).pipe(
                RxOp.map(([gasLimit, rawGasPrices]) => {
                  const gasPrices = applyGasMultiplier(rawGasPrices, gasMultiplier)
                  return getFee({ gasPrice: gasPrices.fast, gasLimit, decimals: gasAssetDecimal })
                }),
                RxOp.map(RD.success),
                RxOp.catchError((error) => Rx.of(RD.failure(error))),
                RxOp.startWith(RD.pending)
              )
          )
        )
      )
    )

  const { get$: reloadApproveFee$, set: reloadApproveFee } = observableState<ApproveParams | undefined>(undefined)

  const approveFee$: ApproveFeeHandler = (params) => {
    return reloadApproveFee$.pipe(
      RxOp.debounceTime(300),
      RxOp.switchMap((approveParams) => {
        return FP.pipe(Rx.from(approveTxFee$(approveParams || params)))
      })
    )
  }

  return {
    fees$,
    reloadFees,
    poolInTxFees$,
    approveFee$,
    reloadApproveFee
  }
}
