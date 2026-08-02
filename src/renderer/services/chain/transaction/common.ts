import * as RD from '@devexperts/remote-data-ts'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ADAChain } from '@xchainjs/xchain-cardano'
import { TxHash } from '@xchainjs/xchain-client'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { CompatibleAsset, SOLChain } from '@xchainjs/xchain-solana'
import { SUIChain } from '@xchainjs/xchain-sui'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { TRONChain } from '@xchainjs/xchain-tron'
import { Address, AssetType, Chain } from '@xchainjs/xchain-util'
import { ZECChain } from '@xchainjs/xchain-zcash'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'

import { isSupportedChain } from '../../../../shared/utils/chain'
import { DEFAULT_FEE_OPTION } from '../../../components/wallet/txs/send/Send.const'
import { getAssetChain } from '../../../helpers/chainHelper'
import { LiveData, liveData } from '../../../helpers/rx/liveData'
import * as ARB from '../../arb'
import * as AVAX from '../../avax'
import * as BASE from '../../base'
import * as BTC from '../../bitcoin'
import * as BCH from '../../bitcoincash'
import * as BSC from '../../bsc'
import * as ADA from '../../cardano'
import * as COSMOS from '../../cosmos'
import * as DASH from '../../dash'
import * as DOGE from '../../doge'
import * as ETH from '../../ethereum'
import * as KUJI from '../../kuji'
import * as LTC from '../../litecoin'
import * as MAYA from '../../mayachain'
import * as XRD from '../../radix'
import * as XRP from '../../ripple'
import * as SOL from '../../solana'
import * as SUI from '../../sui'
import * as THOR from '../../thorchain'
import * as TRON from '../../tron'
import { ApiError, ErrorId, TxHashLD, TxLD } from '../../wallet/types'
import * as ZEC from '../../zcash'
import { utxoFeeRate$ } from '../fees/nodeapi'
import { SendPoolTxParams, SendTxParams } from '../types'

// shared error mapper for UTXO fee-rate resolution
const feeRateError = (error: Error): ApiError => ({
  errorId: ErrorId.GET_FEES,
  msg: error?.message ?? error.toString()
})

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
  walletAccount,
  walletIndex,
  hdMode,
  allowOwnerOffCurve,
  destinationTag,
  sendMax,
  selectedUtxos,
  utxoSelectionPreferences,
  useNodeFeeRate = false
}: SendTxParams): TxHashLD => {
  const { chain } =
    asset.type === AssetType.SYNTH ? AssetCacao : asset.type === AssetType.SECURED ? { chain: THORChain } : asset
  if (!isSupportedChain(chain)) return txFailure$(`${chain} is not supported for 'sendTx$'`)
  switch (chain) {
    case BTCChain:
      return FP.pipe(
        BTC.feesWithRates$(sender, memo),
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain(({ rates }) =>
          FP.pipe(
            utxoFeeRate$(BTCChain, rates[feeOption], useNodeFeeRate),
            liveData.mapLeft(feeRateError),
            liveData.chain((feeRate) =>
              BTC.sendTx({
                walletType,
                recipient,
                asset,
                amount,
                feeOption,
                feeRate,
                memo,
                walletAccount,
                walletIndex,
                hdMode,
                sender,
                sendMax,
                selectedUtxos,
                utxoSelectionPreferences
              })
            )
          )
        )
      )

    case ETHChain:
      return ETH.sendTx({ walletType, asset, recipient, amount, memo, feeOption, walletAccount, walletIndex, hdMode })

    case ARBChain:
      return ARB.sendTx({ walletType, asset, recipient, amount, memo, feeOption, walletAccount, walletIndex, hdMode })

    case AVAXChain:
      return AVAX.sendTx({ walletType, asset, recipient, amount, memo, feeOption, walletAccount, walletIndex, hdMode })

    case BASEChain:
      return BASE.sendTx({ walletType, asset, recipient, amount, memo, feeOption, walletAccount, walletIndex, hdMode })

    case SOLChain:
      return FP.pipe(
        SOL.fees$({ recipient: recipient, amount, asset: asset as CompatibleAsset, memo, allowOwnerOffCurve }),
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain((fees) => {
          return SOL.sendTx({
            walletType,
            sender,
            recipient,
            amount,
            asset,
            memo,
            walletAccount,
            walletIndex,
            hdMode,
            priorityFee: fees[feeOption],
            allowOwnerOffCurve
          })
        })
      )
    case BSCChain:
      return BSC.sendTx({ walletType, asset, recipient, amount, memo, feeOption, walletAccount, walletIndex, hdMode })

    case THORChain:
      return THOR.sendTx({ walletType, amount, asset, memo, recipient, walletAccount, walletIndex, hdMode })
    case MAYAChain:
      return MAYA.sendTx({ walletType, amount, asset, memo, recipient, walletAccount, walletIndex, hdMode })
    case KUJIChain:
      return KUJI.sendTx({ walletType, amount, asset, memo, recipient, walletAccount, walletIndex, hdMode })
    case ADAChain:
      return ADA.sendTx({ walletType, amount, asset, memo, recipient, walletAccount, walletIndex, hdMode, sendMax })
    case RadixChain:
      return XRD.sendTx({ walletType, amount, asset, memo, recipient, walletAccount, walletIndex, hdMode })
    case XRPChain:
      return XRP.sendTx({
        walletType,
        amount,
        asset,
        memo,
        recipient,
        sender,
        walletAccount,
        walletIndex,
        hdMode,
        destinationTag
      })

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
            walletAccount,
            walletIndex,
            hdMode,
            feeAmount: fees[feeOption]
          })
        )
      )

    case DOGEChain:
      return FP.pipe(
        DOGE.feesWithRates$(sender, memo),
        // Error -> ApiError
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain(({ rates }) =>
          FP.pipe(
            utxoFeeRate$(DOGEChain, rates[feeOption], useNodeFeeRate),
            liveData.mapLeft(feeRateError),
            liveData.chain((feeRate) =>
              DOGE.sendTx({
                walletType,
                recipient,
                asset,
                amount,
                feeOption,
                feeRate,
                memo,
                walletAccount,
                walletIndex,
                hdMode,
                sender,
                sendMax,
                selectedUtxos,
                utxoSelectionPreferences
              })
            )
          )
        )
      )

    case BCHChain:
      return FP.pipe(
        BCH.feesWithRates$(sender, memo),
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain(({ rates }) =>
          FP.pipe(
            utxoFeeRate$(BCHChain, rates[feeOption], useNodeFeeRate),
            liveData.mapLeft(feeRateError),
            liveData.chain((feeRate) =>
              BCH.sendTx({
                walletType,
                recipient,
                asset,
                amount,
                feeOption,
                feeRate,
                memo,
                walletAccount,
                walletIndex,
                hdMode,
                sender,
                sendMax,
                selectedUtxos,
                utxoSelectionPreferences
              })
            )
          )
        )
      )
    case LTCChain:
      return FP.pipe(
        LTC.feesWithRates$(sender, memo),
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain(({ rates }) =>
          FP.pipe(
            // replaces `Math.floor`, which turned LTC's sub-1 estimates into a 0 fee rate
            utxoFeeRate$(LTCChain, rates[feeOption], useNodeFeeRate),
            liveData.mapLeft(feeRateError),
            liveData.chain((feeRate) =>
              LTC.sendTx({
                walletType,
                recipient,
                asset,
                amount,
                feeOption,
                feeRate,
                memo,
                walletAccount,
                walletIndex,
                hdMode,
                sender,
                sendMax,
                selectedUtxos,
                utxoSelectionPreferences
              })
            )
          )
        )
      )
    case DASHChain:
      return FP.pipe(
        DASH.feesWithRates$(sender, memo),
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain(({ rates }) =>
          FP.pipe(
            utxoFeeRate$(DASHChain, rates[feeOption], useNodeFeeRate),
            liveData.mapLeft(feeRateError),
            liveData.chain((feeRate) =>
              DASH.sendTx({
                walletType,
                recipient,
                asset,
                amount,
                feeOption,
                feeRate,
                memo,
                walletAccount,
                walletIndex,
                hdMode,
                sender,
                sendMax,
                selectedUtxos,
                utxoSelectionPreferences
              })
            )
          )
        )
      )
    case ZECChain:
      return FP.pipe(
        ZEC.feesWithRates$(sender, memo),
        liveData.mapLeft((error) => ({
          errorId: ErrorId.GET_FEES,
          msg: error?.message ?? error.toString()
        })),
        liveData.chain(({ rates }) => {
          return ZEC.sendTx({
            walletType,
            recipient,
            asset,
            amount,
            feeOption,
            feeRate: rates[feeOption],
            memo,
            walletAccount,
            walletIndex,
            hdMode,
            sender,
            sendMax,
            selectedUtxos,
            utxoSelectionPreferences
          })
        })
      )
    case TRONChain:
      return TRON.sendTx({ walletType, asset, recipient, amount, memo, feeOption, walletAccount, walletIndex, hdMode })

    case SUIChain:
      return SUI.sendTx({ walletType, sender, asset, recipient, amount, memo, walletAccount, walletIndex, hdMode })

    default:
      return txFailure$(`${chain} is not supported for 'sendPoolTx$'`)
  }
}

export const sendPoolTx$ = ({
  sender,
  walletType,
  walletAccount,
  walletIndex,
  hdMode,
  router,
  asset,
  recipient,
  amount,
  memo,
  feeOption = DEFAULT_FEE_OPTION,
  protocol,
  sendMax
}: SendPoolTxParams): TxHashLD => {
  const { chain } = getAssetChain(asset, protocol)
  if (!isSupportedChain(chain)) return txFailure$(`${chain} is not enabled`)

  switch (chain) {
    case ETHChain:
      return ETH.sendPoolTx$({
        walletType,
        router,
        recipient,
        asset,
        amount,
        memo,
        walletAccount,
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
        walletAccount,
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
        walletAccount,
        walletIndex,
        hdMode,
        feeOption
      })
    case BASEChain:
      return BASE.sendPoolTx$({
        walletType,
        router,
        recipient,
        asset,
        amount,
        memo,
        walletAccount,
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
        walletAccount,
        walletIndex,
        hdMode,
        feeOption
      })
    case RadixChain:
      return XRD.sendPoolTx$({
        walletType,
        router,
        recipient,
        asset,
        amount,
        memo,
        walletAccount,
        walletIndex,
        hdMode
      })

    case THORChain:
      return protocol === THORChain
        ? THOR.sendPoolTx$({ walletType, amount, asset, memo, walletAccount, walletIndex, hdMode })
        : THOR.sendTx({ sender, walletType, asset, recipient, amount, memo, walletAccount, walletIndex, hdMode })

    case MAYAChain:
      return protocol === MAYAChain
        ? MAYA.sendPoolTx$({ walletType, amount, asset, memo, walletAccount, walletIndex, hdMode })
        : MAYA.sendTx({ sender, walletType, asset, recipient, amount, memo, walletAccount, walletIndex, hdMode })

    case BTCChain:
    case BCHChain:
    case DOGEChain:
    case LTCChain:
    case DASHChain:
    case ZECChain:
    case GAIAChain:
    case KUJIChain:
    case ADAChain:
    case XRPChain:
    case SOLChain:
    case SUIChain:
    case TRONChain:
      return sendTx$({
        sender,
        walletType,
        asset,
        recipient,
        amount,
        memo,
        feeOption,
        walletAccount,
        walletIndex,
        hdMode,
        sendMax,
        // inbounds must not be sent below the vault's recommended `gas_rate`
        useNodeFeeRate: true
      })
    default:
      return txFailure$(`${chain} is not supported for 'sendPoolTx$'`)
  }
}
export const txStatusByChain$: (params: { txHash: TxHash; chain: Chain }) => TxLD = ({ txHash, chain }) => {
  if (!isSupportedChain(chain)) {
    return Rx.of(
      RD.failure({
        errorId: ErrorId.GET_TX,
        msg: `${chain} is not enabled`
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
    case BASEChain:
      return BASE.txStatus$(txHash, O.none)
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
    case ADAChain:
      return ADA.txStatus$(txHash, O.none)
    case RadixChain:
      return XRD.txStatus$(txHash, O.none)
    case XRPChain:
      return XRP.txStatus$(txHash, O.none)
    case SOLChain:
      return SOL.txStatus$(txHash, O.none)
    case ZECChain:
      return ZEC.txStatus$(txHash, O.none)
    case TRONChain:
      return TRON.txStatus$(txHash, O.none)
    case SUIChain:
      return SUI.txStatus$(txHash, O.none)
    default:
      return Rx.of(
        RD.failure({
          errorId: ErrorId.GET_TX,
          msg: `${chain} is not supported by 'txStatusByChain$'`
        })
      )
  }
}

const getTxStatusByChain = ({
  txHash,
  chain,
  assetAddress
}: {
  txHash: TxHash
  chain: Chain
  assetAddress: O.Option<Address>
}): TxLD => {
  switch (chain) {
    case ETHChain:
      return ETH.txStatus$(txHash, assetAddress)
    case ARBChain:
      return ARB.txStatus$(txHash, assetAddress)
    case AVAXChain:
      return AVAX.txStatus$(txHash, assetAddress)
    case BASEChain:
      return BASE.txStatus$(txHash, assetAddress)
    case BSCChain:
      return BSC.txStatus$(txHash, assetAddress)
    default:
      return txStatusByChain$({ txHash, chain })
  }
}

export const poolTxStatusByChain$: (params: {
  txHash: TxHash
  chain: Chain
  assetAddress: O.Option<Address>
}) => TxLD = ({ txHash, chain, assetAddress }) => {
  if (!isSupportedChain(chain)) {
    return Rx.of(
      RD.failure({
        errorId: ErrorId.GET_TX,
        msg: `${chain} is not supported for 'poolTxStatusByChain$'`
      })
    )
  }

  return getTxStatusByChain({ txHash, chain, assetAddress })
}
