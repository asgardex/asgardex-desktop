import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { TxHash } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address } from '@xchainjs/xchain-util'
import { Chain } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import { isEnabledChain } from '../../../../shared/utils/chain'
import { DEFAULT_FEE_OPTION } from '../../../components/wallet/txs/send/Send.const'
import { LiveData, liveData } from '../../../helpers/rx/liveData'
import * as ARB from '../../arb'
import * as AVAX from '../../avax'
import * as BTC from '../../bitcoin'
import * as BCH from '../../bitcoincash'
import * as BSC from '../../bsc'
import * as COSMOS from '../../cosmos'
import * as DASH from '../../dash'
import * as DOGE from '../../doge'
import * as ETH from '../../ethereum'
import * as KUJI from '../../kuji'
import * as LTC from '../../litecoin'
import * as MAYA from '../../mayachain'
import * as THOR from '../../thorchain'
import { ApiError, ErrorId, TxHashLD, TxLD } from '../../wallet/types'
import { SendPoolTxParams, SendTxParams } from '../types'

// helper to create `RemoteData<ApiError, never>` observable
const txFailure$ = (msg: string): LiveData<ApiError, never> =>
  Rx.of(
    RD.failure({
      errorId: ErrorId.SEND_TX,
      msg
    })
  )

export const sendTx$ = ({
  walletType,
  asset,
  sender,
  recipient,
  amount,
  memo,
  feeOption = DEFAULT_FEE_OPTION,
  walletIndex,
  hdMode,
  dex
}: SendTxParams): TxHashLD => {
  const { chain } = asset.synth ? dex.asset : asset
  if (!isEnabledChain(chain)) return txFailure$(`${chain} is not supported for 'sendTx$'`)

  switch (chain) {
    case BTCChain:
      return FP.pipe(
        BTC.feesWithRates$(memo),
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain(({ rates }) =>
          BTC.sendTx({ walletType, recipient, amount, feeRate: rates[feeOption], memo, walletIndex, hdMode, sender })
        )
      )

    case ETHChain:
      return ETH.sendTx({ walletType, asset, recipient, amount, memo, feeOption, walletIndex, hdMode })

    case ARBChain:
      return ARB.sendTx({ walletType, asset, recipient, amount, memo, feeOption, walletIndex, hdMode })

    case AVAXChain:
      return AVAX.sendTx({ walletType, asset, recipient, amount, memo, feeOption, walletIndex, hdMode })

    case BSCChain:
      return BSC.sendTx({ walletType, asset, recipient, amount, memo, feeOption, walletIndex, hdMode })

    case THORChain:
      return THOR.sendTx({ walletType, amount, asset, memo, recipient, walletIndex, hdMode })
    case MAYAChain:
      return MAYA.sendTx({ walletType, amount, asset, memo, recipient, walletIndex, hdMode })
    case KUJIChain:
      return KUJI.sendTx({ walletType, amount, asset, memo, recipient, walletIndex, hdMode })

    case GAIAChain:
      return FP.pipe(
        COSMOS.fees$(),
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain((fees) =>
          // fees for COSMOS are FLAT fees for now - different `feeOption` based still on same fee amount
          // If needed, we can change it later to have fee options (similar to Keplr wallet - search for `gasPriceStep` there)
          COSMOS.sendTx({
            walletType,
            sender,
            recipient,
            amount,
            asset,
            memo,
            walletIndex,
            hdMode,
            feeAmount: fees[feeOption]
          })
        )
      )

    case DOGEChain:
      return FP.pipe(
        DOGE.feesWithRates$(memo),
        // Error -> ApiError
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain(({ rates }) =>
          DOGE.sendTx({ walletType, recipient, amount, feeRate: rates[feeOption], memo, walletIndex, hdMode, sender })
        )
      )

    case BCHChain:
      return FP.pipe(
        BCH.feesWithRates$(memo),
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain(({ rates }) =>
          BCH.sendTx({ walletType, recipient, amount, feeRate: rates[feeOption], memo, walletIndex, hdMode, sender })
        )
      )
    case LTCChain:
      return FP.pipe(
        LTC.feesWithRates$(memo),
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain(({ rates }) => {
          return LTC.sendTx({
            walletType,
            recipient,
            amount,
            feeRate: rates[feeOption],
            memo,
            walletIndex,
            hdMode,
            sender
          })
        })
      )
    case DASHChain:
      return FP.pipe(
        DASH.feesWithRates$(memo),
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain(({ rates }) => {
          return DASH.sendTx({
            walletType,
            recipient,
            amount,
            feeRate: rates[feeOption],
            memo,
            walletIndex,
            hdMode,
            sender
          })
        })
      )
  }
}

export const sendPoolTx$ = ({
  sender,
  walletType,
  walletIndex,
  hdMode,
  router,
  asset,
  recipient,
  amount,
  memo,
  feeOption = DEFAULT_FEE_OPTION,
  dex
}: SendPoolTxParams): TxHashLD => {
  // update this to suit MayaChainSwap
  const { chain } = asset.synth ? dex.asset : asset

  if (!isEnabledChain(chain)) return txFailure$(`${chain} is not supported for 'sendPoolTx$'`)
  switch (chain) {
    case ETHChain:
      return ETH.sendPoolTx$({
        walletType,
        router,
        recipient,
        asset,
        amount,
        memo,
        walletIndex,
        hdMode,
        feeOption
      })
    case ARBChain:
      return ARB.sendPoolTx$({
        walletType,
        router,
        recipient,
        asset,
        amount,
        memo,
        walletIndex,
        hdMode,
        feeOption
      })
    case AVAXChain:
      return AVAX.sendPoolTx$({
        walletType,
        router,
        recipient,
        asset,
        amount,
        memo,
        walletIndex,
        hdMode,
        feeOption
      })
    case BSCChain:
      return BSC.sendPoolTx$({
        walletType,
        router,
        recipient,
        asset,
        amount,
        memo,
        walletIndex,
        hdMode,
        feeOption
      })

    case THORChain:
      return dex.chain === THORChain
        ? THOR.sendPoolTx$({ walletType, amount, asset, memo, walletIndex, hdMode })
        : THOR.sendTx({ sender, walletType, asset, recipient, amount, memo, walletIndex, hdMode })

    case MAYAChain:
      return MAYA.sendPoolTx$({ walletType, amount, asset, memo, walletIndex, hdMode })

    case BTCChain:
    case BCHChain:
    case DOGEChain:
    case LTCChain:
    case DASHChain:
    case GAIAChain:
    case KUJIChain:
      return sendTx$({ sender, walletType, asset, recipient, amount, memo, feeOption, walletIndex, hdMode, dex })
  }
}

export const txStatusByChain$ = ({ txHash, chain }: { txHash: TxHash; chain: Chain }): TxLD => {
  if (!isEnabledChain(chain)) {
    return Rx.of(
      RD.failure({
        errorId: ErrorId.GET_TX,
        msg: `${chain} is not supported for 'txStatusByChain$'`
      })
    )
  }

  switch (chain) {
    case BTCChain:
      return BTC.txStatus$(txHash, O.none)
    case ETHChain:
      return ETH.txStatus$(txHash, O.none)
    case ARBChain:
      return ARB.txStatus$(txHash, O.none)
    case AVAXChain:
      return AVAX.txStatus$(txHash, O.none)
    case BSCChain:
      return BSC.txStatus$(txHash, O.none)
    case THORChain:
      return THOR.txStatus$(txHash, O.none)
    case MAYAChain:
      return MAYA.txStatus$(txHash, O.none)
    case GAIAChain:
      return COSMOS.txStatus$(txHash, O.none)
    case DOGEChain:
      return DOGE.txStatus$(txHash, O.none)
    case BCHChain:
      return BCH.txStatus$(txHash, O.none)
    case LTCChain:
      return LTC.txStatus$(txHash, O.none)
    case DASHChain:
      return DASH.txStatus$(txHash, O.none)
    case KUJIChain:
      return KUJI.txStatus$(txHash, O.none)
  }
}

export const poolTxStatusByChain$ = ({
  txHash,
  chain,
  assetAddress: oAssetAddress
}: {
  txHash: TxHash
  chain: Chain
  assetAddress: O.Option<Address>
}): TxLD => {
  if (!isEnabledChain(chain)) {
    return Rx.of(
      RD.failure({
        errorId: ErrorId.GET_TX,
        msg: `${chain} is not supported for 'poolTxStatusByChain$'`
      })
    )
  }

  switch (chain) {
    case ETHChain:
      return ETH.txStatus$(txHash, oAssetAddress)
    case ARBChain:
      return ARB.txStatus$(txHash, oAssetAddress)
    case AVAXChain:
      return AVAX.txStatus$(txHash, oAssetAddress)
    case BSCChain:
      return BSC.txStatus$(txHash, oAssetAddress)
    case BTCChain:
    case THORChain:
    case MAYAChain:
    case GAIAChain:
    case DOGEChain:
    case BCHChain:
    case LTCChain:
    case DASHChain:
    case KUJIChain:
      return txStatusByChain$({ txHash, chain })
  }
}
