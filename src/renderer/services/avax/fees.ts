import * as RD from '@devexperts/remote-data-ts'
import { AVAX_GAS_ASSET_DECIMAL } from '@xchainjs/xchain-avax'
import { Fees, FeeType, TxParams } from '@xchainjs/xchain-client'
import { getFee, GasPrices } from '@xchainjs/xchain-evm'
import { Asset, baseAmount } from '@xchainjs/xchain-util'
import { ethers } from 'ethers'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { AvaxZeroAddress } from '../../../shared/avax/const'
import { isAvaxAsset } from '../../helpers/assetHelper'
import { observableState } from '../../helpers/stateHelper'
import { FeeLD } from '../chain/types'
import * as C from '../clients'
import { FeesLD } from '../clients'
import { FeesService, PollInTxFeeParams, ApproveFeeHandler, ApproveParams } from '../evm/types'
import { Client$ } from './types'

export const ETH_OUT_TX_GAS_LIMIT = ethers.BigNumber.from('35609')
export const ERC20_OUT_TX_GAS_LIMIT = ethers.BigNumber.from('49610')

export const createFeesService = (client$: Client$): FeesService => {
  const { get$: reloadFees$, set: reloadFees } = observableState<TxParams>({
    amount: baseAmount(1),
    recipient: AvaxZeroAddress
  })

  const fees$ = (params: TxParams): FeesLD =>
    Rx.combineLatest([reloadFees$, client$]).pipe(
      RxOp.switchMap(([reloadFeesParams, oClient]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.EMPTY,
            (client) => Rx.from(client.getFees(reloadFeesParams || params))
          )
        )
      ),
      RxOp.map(RD.success),
      RxOp.catchError((error) => Rx.of(RD.failure(error))),
      RxOp.startWith(RD.pending)
    )

  /**
   * Fees for sending txs into pool on Ethereum
   **/
  const poolInTxFees$ = ({ address, abi, func, params }: PollInTxFeeParams): C.FeesLD =>
    client$.pipe(
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) =>
              Rx.combineLatest([
                client.estimateCall({ contractAddress: address, abi, funcName: func, funcParams: params }),
                client.estimateGasPrices()
              ]).pipe(
                RxOp.map<[ethers.BigNumber, GasPrices], Fees>(([gasLimit, gasPrices]) => ({
                  type: FeeType.PerByte,
                  average: getFee({ gasPrice: gasPrices.average, gasLimit, decimals: AVAX_GAS_ASSET_DECIMAL }),
                  fast: getFee({ gasPrice: gasPrices.fast, gasLimit, decimals: AVAX_GAS_ASSET_DECIMAL }),
                  fastest: getFee({ gasPrice: gasPrices.fastest, gasLimit, decimals: AVAX_GAS_ASSET_DECIMAL })
                })),
                RxOp.map(RD.success),
                RxOp.catchError((error) => Rx.of(RD.failure(error))),
                RxOp.startWith(RD.pending)
              )
          )
        )
      )
    )

  /**
   * Fees for sending txs out of a pool on Ethereum
   **/
  const poolOutTxFee$ = (asset: Asset): C.FeesLD =>
    client$.pipe(
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) => {
              const gasLimit = isAvaxAsset(asset) ? ETH_OUT_TX_GAS_LIMIT : ERC20_OUT_TX_GAS_LIMIT
              return Rx.from(client.estimateGasPrices()).pipe(
                RxOp.map<GasPrices, Fees>((gasPrices) => ({
                  type: FeeType.PerByte,
                  average: getFee({ gasPrice: gasPrices.average, gasLimit, decimals: AVAX_GAS_ASSET_DECIMAL }),
                  fast: getFee({ gasPrice: gasPrices.fast, gasLimit, decimals: AVAX_GAS_ASSET_DECIMAL }),
                  fastest: getFee({ gasPrice: gasPrices.fastest, gasLimit, decimals: AVAX_GAS_ASSET_DECIMAL })
                })),
                RxOp.map(RD.success),
                RxOp.catchError((error) => Rx.of(RD.failure(error))),
                RxOp.startWith(RD.pending)
              )
            }
          )
        )
      )
    )

  /**
   * Fees for approve Tx
   **/
  const approveTxFee$ = ({ spenderAddress, contractAddress, fromAddress }: ApproveParams): FeeLD =>
    client$.pipe(
      RxOp.switchMap((oClient) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) =>
              Rx.combineLatest([
                client.estimateApprove({ contractAddress, spenderAddress, fromAddress }),
                client.estimateGasPrices()
              ]).pipe(
                RxOp.map(([gasLimit, gasPrices]) =>
                  getFee({ gasPrice: gasPrices.fast, gasLimit, decimals: AVAX_GAS_ASSET_DECIMAL })
                ),
                RxOp.map(RD.success),
                RxOp.catchError((error) => Rx.of(RD.failure(error))),
                RxOp.startWith(RD.pending)
              )
          )
        )
      )
    )

  // state for reloading approve fees
  const { get$: reloadApproveFee$, set: reloadApproveFee } = observableState<ApproveParams | undefined>(undefined)

  const approveFee$: ApproveFeeHandler = (params) => {
    return reloadApproveFee$.pipe(
      RxOp.debounceTime(300),
      RxOp.switchMap((approveParams) => {
        return FP.pipe(
          Rx.from(
            // asset
            approveTxFee$(approveParams || params)
          )
        )
      })
    )
  }

  return {
    fees$,
    reloadFees,
    poolInTxFees$,
    poolOutTxFee$,
    approveFee$,
    reloadApproveFee
  }
}
