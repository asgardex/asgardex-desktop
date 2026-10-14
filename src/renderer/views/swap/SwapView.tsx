import { useCallback, useEffect, useMemo, useState } from 'react'

import { AssetData } from '@chainflip/sdk/swap'
import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'

import {
  Address,
  assetToString,
  bn,
  Chain,
  baseAmount,
  AnyAsset,
  AssetType,
  Asset as XAsset,
  TokenAsset as XTokenAsset
} from '@xchainjs/xchain-util'
import { function as FP, array as A, eq as Eq, option as O } from 'fp-ts'
import { Either, isLeft, left, right } from 'fp-ts/lib/Either'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { mayaDetails } from '../../../shared/api/types'
import { AssetCacao, AssetRuneNative } from '../../../shared/utils/asset'
import { isChainOfMaya, isChainOfThor } from '../../../shared/utils/chain'
import { THORChain, MAYAChain, BTCChain } from '../../../shared/utils/chainIds'
import { isLedgerWallet, isWalletType } from '../../../shared/utils/guard'
import { WalletType } from '../../../shared/wallet/types'
import { ErrorView } from '../../components/shared/error/'
import { Swap, TradeSwap } from '../../components/swap'
import { SLIP_TOLERANCE_KEY } from '../../components/swap/SelectableSlipTolerance'
import { SwapAsset } from '../../components/swap/Swap.types'
import * as Utils from '../../components/swap/Swap.utils'
import { BackLinkButton, Button, RefreshButton } from '../../components/uielements/button'
import { Spin } from '../../components/uielements/spin'
import { DEFAULT_WALLET_TYPE } from '../../const'
import { useAppContext } from '../../contexts/AppContext'
import { useChainContext } from '../../contexts/ChainContext'
import { useChainflipContext } from '../../contexts/ChainflipContext'
import { useEvmContext } from '../../contexts/EvmContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useMayachainQueryContext } from '../../contexts/MayachainQueryContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useOneClickContext } from '../../contexts/OneClickContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useThorchainQueryContext } from '../../contexts/ThorchainQueryContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { assetInList, getAssetFromNullableString } from '../../helpers/assetHelper'
import { eqChain, eqNetwork } from '../../helpers/fp/eq'
import { sequenceTOption, sequenceTRD } from '../../helpers/fpHelpers'
import { logger } from '../../helpers/logger'
import * as PoolHelpers from '../../helpers/poolHelper'
import { addressFromOptionalWalletAddress, getWalletAddressFromNullableString } from '../../helpers/walletHelper'
import { useThorchainMimirHalt } from '../../hooks/useMimirHalt'
import { useNetwork } from '../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../hooks/useOpenExplorerTxUrl'
import { useValidateAddress } from '../../hooks/useValidateAddress'
import { swap } from '../../routes/pools'
import { SwapRouteParams, SwapRouteTargetWalletType } from '../../routes/pools/swap'
import * as walletRoutes from '../../routes/wallet'
import { getDecimalSync } from '../../services/chain/decimal'
import { AssetWithDecimalRD } from '../../services/chain/types'
import { cAssetToXAsset, cChainToXChain } from '../../services/chainflip/utils'
import { DEFAULT_SLIP_TOLERANCE } from '../../services/const'
import {
  PendingPoolsState as MayaPendingPoolsState,
  PoolsState as MayaPoolsState
} from '../../services/midgard/mayaMidgard/types'
import { PendingPoolsState, PoolAssetDetail, PoolsState } from '../../services/midgard/midgardTypes'
import { TradeAccount } from '../../services/thorchain/types'
import { INITIAL_BALANCES_STATE, DEFAULT_BALANCES_FILTER } from '../../services/wallet/const'
import { ledgerAddressToWalletAddress } from '../../services/wallet/util'
import { useApp } from '../../store/app/hooks'
import { AssetWithDecimal, isSlipTolerance, SlipTolerance } from '../../types/asgardex'

type UpdateLedgerAddress = { chain: Chain; network: Network }

const eqUpdateLedgerAddress = Eq.struct<UpdateLedgerAddress>({
  chain: eqChain,
  network: eqNetwork
})

type PoolDecimalArgs = Parameters<typeof getDecimalSync>

// Decimals are known synchronously. Building a new observable that starts at Pending
// unmounted the swap form whenever pools or Chainflip assets refreshed.
const assetDecimalRD = (
  asset: AnyAsset,
  thorPoolDetails: PoolDecimalArgs[1],
  mayaPoolDetails: PoolDecimalArgs[2],
  chainflipDecimal?: number
): AssetWithDecimalRD => {
  if (
    chainflipDecimal !== undefined &&
    asset.type !== AssetType.SYNTH &&
    asset.type !== AssetType.SECURED &&
    asset.type !== AssetType.TRADE
  ) {
    return RD.success({ asset, decimal: chainflipDecimal })
  }

  const decimal =
    asset.type === AssetType.SECURED || asset.type === AssetType.TRADE
      ? getDecimalSync(AssetRuneNative, thorPoolDetails, mayaPoolDetails)
      : asset.type === AssetType.SYNTH
        ? getDecimalSync(AssetCacao, thorPoolDetails, mayaPoolDetails)
        : getDecimalSync(asset, thorPoolDetails, mayaPoolDetails)

  return RD.success({ asset, decimal })
}

const chainflipDecimalFor = (
  asset: AnyAsset,
  chainFlipAssets: RD.RemoteData<Error, AssetData[]>
): number | undefined => {
  if (!RD.isSuccess(chainFlipAssets)) return undefined
  const matchingAsset = chainFlipAssets.value.find((candidate) => {
    const chainflipChain = cChainToXChain(candidate.chain)
    return chainflipChain && chainflipChain === asset.chain && candidate.asset === asset.ticker
  })
  return matchingAsset?.decimals
}

type Props = {
  sourceAsset: AnyAsset
  targetAsset: AnyAsset
  sourceWalletType: WalletType
  targetWalletType: O.Option<WalletType>
  recipientAddress: O.Option<Address>
}

const SuccessRouteView = ({
  sourceAsset,
  targetAsset,
  sourceWalletType,
  targetWalletType: oTargetWalletType,
  recipientAddress: oRecipientAddress
}: Props): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const location = useLocation()

  const { streamingSlipTolerance$, changeStreamingSlipTolerance } = useAppContext()

  const { network } = useNetwork()

  const { reloadInboundAddresses, reloadTxStatus, transactionTrackingService } = useThorchainContext()
  const {
    reloadInboundAddresses: reloadMayaInboundAddresses,
    transactionTrackingService: mayaTransactionTrackingService
  } = useMayachainContext()

  const { service: midgardService } = useMidgardContext()
  const { service: midgardMayaService } = useMidgardMayaContext()
  const {
    pools: {
      poolsState$,
      reloadPools: reloadThorPools,
      reloadSelectedPoolDetail,
      selectedPoolAddress$,
      pendingPoolsState$
    },
    setSelectedPoolAsset
  } = midgardService
  const {
    pools: {
      poolsState$: mayaPoolsState$,
      reloadPools: reloadMayaPools,
      reloadSelectedPoolDetail: reloadSelectedPoolDetailMaya,
      selectedPoolAddress$: selectedPoolAddressMaya$,
      pendingPoolsState$: pendingPoolsStateMaya$
    },
    setSelectedPoolAsset: setSelectedPoolAssetMaya
  } = midgardMayaService

  const { isPrivate } = useApp()

  const { getAssetsData$ } = useChainflipContext()

  const [chainFlipAssets] = useObservableState(
    () =>
      getAssetsData$().pipe(
        RxOp.catchError(() => {
          // If Chainflip fails (429 or other errors), return empty array instead of failing
          logger.warn('Chainflip assets unavailable, continuing without Chainflip support')
          return Rx.of(RD.success([]))
        }),
        RxOp.startWith(RD.success([])) // Ensure we always start with a success state
      ),
    RD.success([])
  )

  // OneClick (NEAR Intents) routable assets — extends the swap asset universe
  // beyond THOR/MAYA pools and Chainflip (e.g. SUI, ADA, NEAR which only 1Click routes).
  // The service degrades to an empty success on API failure, so no extra guard.
  const { getAssetsData$: getOneClickAssetsData$ } = useOneClickContext()
  const [oneClickAssetsRD] = useObservableState(() => getOneClickAssetsData$(), RD.success([]))
  const oneClickAssets = useMemo(
    () => (RD.isSuccess(oneClickAssetsRD) ? oneClickAssetsRD.value : []),
    [oneClickAssetsRD]
  )

  const { reloadSwapFees, swapFees$, addressByChain$, swap$, swapCF$, swapOneClick$ } = useChainContext()

  const {
    balancesState$,
    reloadBalancesByChain,
    getLedgerAddress$,
    keystoreService: { keystoreState$, validatePassword$ }
  } = useWalletContext()

  const { chain: sourceChain } =
    sourceAsset.type === AssetType.SYNTH
      ? mayaDetails.asset
      : sourceAsset.type === AssetType.SECURED
        ? AssetRuneNative
        : sourceAsset
  const { chain: targetChain } =
    targetAsset.type === AssetType.SYNTH
      ? mayaDetails.asset
      : targetAsset.type === AssetType.SECURED
        ? AssetRuneNative
        : targetAsset

  useEffect(() => {
    // Source asset is the asset of the pool we need to interact with
    // Store it in global state, all depending streams will be updated then
    setSelectedPoolAsset(O.some(sourceAsset))
    setSelectedPoolAssetMaya(O.some(sourceAsset))
    // Reset selectedPoolAsset on view's unmount to avoid effects with depending streams
    return () => {
      setSelectedPoolAsset(O.none)
      setSelectedPoolAssetMaya(O.none)
    }
  }, [sourceAsset, setSelectedPoolAsset, setSelectedPoolAssetMaya])
  const selectedPoolAddressThor = useObservableState(selectedPoolAddress$, O.none)
  const selectedPoolAddressMaya = useObservableState(selectedPoolAddressMaya$, O.none)

  // switches sourcechain context eth | avax | bsc - needed for approve
  const { reloadApproveFee, approveFee$, approveERC20Token$, isApprovedERC20Token$ } = useEvmContext(sourceChain)

  const keystore = useObservableState(keystoreState$, O.none)

  const poolsStateThorRD = useObservableState(poolsState$, RD.initial)
  const poolsStateMayaRD = useObservableState(mayaPoolsState$, RD.initial)
  const pendingPoolsStateRD = useObservableState(pendingPoolsState$, RD.initial)
  const pendingPoolsStateMayaRD = useObservableState(pendingPoolsStateMaya$, RD.initial)

  // Tolerate THOR/MAYA pool fetch failures so Chainflip swaps stay reachable when
  // a Midgard endpoint is down. Failure is treated as "no pools from that source"
  // rather than gating the whole swap view.
  const emptyThorPoolsState: PoolsState = {
    poolAssets: [],
    assetDetails: [],
    poolDetails: [],
    poolsData: {},
    pricePools: O.none
  }
  const emptyMayaPoolsState: MayaPoolsState = {
    poolAssets: [],
    assetDetails: [],
    poolDetails: [],
    poolsData: {},
    pricePools: O.none
  }
  const emptyThorPendingPoolsState: PendingPoolsState = { poolAssets: [], assetDetails: [], poolDetails: [] }
  const emptyMayaPendingPoolsState: MayaPendingPoolsState = { poolAssets: [], assetDetails: [], poolDetails: [] }
  const tolerantPoolsStateThorRD: RD.RemoteData<Error, PoolsState> = RD.isFailure(poolsStateThorRD)
    ? RD.success(emptyThorPoolsState)
    : poolsStateThorRD
  const tolerantPoolsStateMayaRD: RD.RemoteData<Error, MayaPoolsState> = RD.isFailure(poolsStateMayaRD)
    ? RD.success(emptyMayaPoolsState)
    : poolsStateMayaRD
  const tolerantPendingPoolsStateRD: RD.RemoteData<Error, PendingPoolsState> = RD.isFailure(pendingPoolsStateRD)
    ? RD.success(emptyThorPendingPoolsState)
    : pendingPoolsStateRD
  const tolerantPendingPoolsStateMayaRD: RD.RemoteData<Error, MayaPendingPoolsState> = RD.isFailure(
    pendingPoolsStateMayaRD
  )
    ? RD.success(emptyMayaPendingPoolsState)
    : pendingPoolsStateMayaRD

  const thorPoolDetails = RD.isSuccess(poolsStateThorRD) ? poolsStateThorRD.value.poolDetails : undefined
  const mayaPoolDetails = RD.isSuccess(poolsStateMayaRD) ? poolsStateMayaRD.value.poolDetails : undefined

  const sourceAssetRD: AssetWithDecimalRD = useMemo(
    () =>
      assetDecimalRD(sourceAsset, thorPoolDetails, mayaPoolDetails, chainflipDecimalFor(sourceAsset, chainFlipAssets)),
    [chainFlipAssets, mayaPoolDetails, sourceAsset, thorPoolDetails]
  )

  // Log the resolved source asset decimal
  useEffect(() => {
    if (RD.isSuccess(sourceAssetRD)) {
      logger.debug('[SwapView] sourceAssetRD resolved:', {
        asset: `${sourceAssetRD.value.asset.chain}.${sourceAssetRD.value.asset.symbol}`,
        decimal: sourceAssetRD.value.decimal
      })
    }
  }, [sourceAssetRD])

  const targetAssetRD: AssetWithDecimalRD = useMemo(
    () => assetDecimalRD(targetAsset, thorPoolDetails, mayaPoolDetails),
    [mayaPoolDetails, targetAsset, thorPoolDetails]
  )

  const [balancesState] = useObservableState(
    () =>
      balancesState$({
        ...DEFAULT_BALANCES_FILTER,
        [BTCChain]: 'confirmed'
      }),
    INITIAL_BALANCES_STATE
  )

  const reloadPools = useCallback(() => {
    reloadThorPools()
    reloadMayaPools()
  }, [reloadMayaPools, reloadThorPools])

  const [oSourceKeystoreAddress, updateSourceKeystoreAddress$] = useObservableState<O.Option<Address>, Chain>(
    (sourceChain$) =>
      FP.pipe(
        sourceChain$,
        RxOp.distinctUntilChanged(eqChain.equals),
        RxOp.switchMap(addressByChain$),
        RxOp.map(addressFromOptionalWalletAddress)
      ),
    O.none
  )

  const [oTargetKeystoreAddress, updateTargetKeystoreAddress$] = useObservableState<O.Option<Address>, Chain>(
    (targetChain$) =>
      FP.pipe(
        targetChain$,
        RxOp.distinctUntilChanged(eqChain.equals),
        RxOp.switchMap(addressByChain$),
        RxOp.map(addressFromOptionalWalletAddress)
      ),
    O.none
  )

  const renderError = useCallback(
    (e: Error) => (
      <ErrorView
        title={intl.formatMessage({ id: 'common.error' })}
        subTitle={e?.message ?? e.toString()}
        extra={<Button onClick={reloadPools}>{intl.formatMessage({ id: 'common.retry' })}</Button>}
      />
    ),
    [intl, reloadPools]
  )

  const reloadBalances = useCallback(() => {
    reloadBalancesByChain(sourceChain, sourceWalletType)()
  }, [reloadBalancesByChain, sourceChain, sourceWalletType])

  const reloadSwapTxStatus = useCallback(() => {
    reloadTxStatus()
  }, [reloadTxStatus])

  const reloadHandler = useCallback(() => {
    reloadBalances()
    reloadInboundAddresses()
    reloadSelectedPoolDetail()
    reloadMayaInboundAddresses()
    reloadSelectedPoolDetailMaya()
  }, [
    reloadBalances,
    reloadInboundAddresses,
    reloadMayaInboundAddresses,
    reloadSelectedPoolDetail,
    reloadSelectedPoolDetailMaya
  ])

  const getStoredSlipTolerance = (key: string): SlipTolerance =>
    FP.pipe(
      localStorage.getItem(key),
      O.fromNullable,
      O.map((s) => {
        const itemAsNumber = Number(s)
        return isSlipTolerance(itemAsNumber) ? itemAsNumber : DEFAULT_SLIP_TOLERANCE
      }),
      O.getOrElse(() => DEFAULT_SLIP_TOLERANCE)
    )

  const slipTolerance = useObservableState<SlipTolerance>(
    streamingSlipTolerance$,
    getStoredSlipTolerance(`${SLIP_TOLERANCE_KEY}_STREAMING`)
  )

  const onChangeAssetHandler = useCallback(
    ({
      source,
      sourceWalletType,
      target,
      targetWalletType: oTargetWalletType,
      recipientAddress: oRecipientAddress
    }: {
      source: AnyAsset
      target: AnyAsset
      sourceWalletType: WalletType
      targetWalletType: O.Option<WalletType>
      recipientAddress: O.Option<Address>
    }) => {
      const targetWalletType = FP.pipe(
        oTargetWalletType,
        O.getOrElse<SwapRouteTargetWalletType>(() => 'custom')
      )
      const recipient = FP.pipe(oRecipientAddress, O.toUndefined)

      const path = swap.path({
        source: assetToString(source),
        sourceWalletType,
        target: assetToString(target),
        targetWalletType,
        recipient
      })
      navigate(path, { replace: true })
    },
    [navigate]
  )

  const importWalletHandler = useCallback(() => {
    navigate(walletRoutes.base.path(location.pathname))
  }, [location.pathname, navigate])

  const [oTargetLedgerAddress, updateTargetLedgerAddress$] = useObservableState<O.Option<Address>, UpdateLedgerAddress>(
    (targetLedgerAddressChain$) =>
      FP.pipe(
        targetLedgerAddressChain$,
        RxOp.distinctUntilChanged(eqUpdateLedgerAddress.equals),
        RxOp.switchMap(({ chain }) => getLedgerAddress$(chain)),
        RxOp.map(O.map(ledgerAddressToWalletAddress)),
        RxOp.map(addressFromOptionalWalletAddress)
      ),
    O.none
  )
  const [oSourceLedgerAddress, updateSourceLedgerAddress$] = useObservableState<O.Option<Address>, UpdateLedgerAddress>(
    (sourceLedgerAddressChain$) =>
      FP.pipe(
        sourceLedgerAddressChain$,
        RxOp.distinctUntilChanged(eqUpdateLedgerAddress.equals),
        RxOp.switchMap(({ chain }) => {
          return getLedgerAddress$(chain)
        }),
        RxOp.map(O.map(ledgerAddressToWalletAddress)),
        RxOp.map(addressFromOptionalWalletAddress)
      ),
    O.none
  )

  useEffect(() => {
    updateTargetKeystoreAddress$(targetChain)
    updateSourceKeystoreAddress$(sourceChain)
    updateSourceLedgerAddress$({ chain: sourceChain, network })
    updateTargetLedgerAddress$({ chain: targetChain, network })
  }, [
    network,
    sourceChain,
    targetChain,
    updateSourceKeystoreAddress$,
    updateSourceLedgerAddress$,
    updateTargetKeystoreAddress$,
    updateTargetLedgerAddress$
  ])

  const isTargetLedger = FP.pipe(
    oTargetWalletType,
    O.map(isLedgerWallet),
    O.getOrElse(() => false)
  )

  const oRecipient: O.Option<Address> = FP.pipe(
    oRecipientAddress,
    O.fromPredicate(O.isSome),
    O.flatten,
    O.alt(() => (isTargetLedger ? oTargetLedgerAddress : oTargetKeystoreAddress))
  )

  const { validateSwapAddress } = useValidateAddress(targetChain)

  // Helper function to determine Midgard pool set for pricing stubs.
  // OneClick/Chainflip-only chains (e.g. NEAR) are on neither THOR nor MAYA —
  // return an empty list so validatePoolAssets can fill from poolless asset lists
  // instead of hard-failing the swap page.
  const getPoolAssetDetails = (
    sourceAsset: AssetWithDecimal,
    targetAsset: AssetWithDecimal,
    thorchainPoolAssetDetails: PoolAssetDetail[],
    mayachainPoolAssetDetails: PoolAssetDetail[]
  ): Either<Error, PoolAssetDetail[]> => {
    const sourceChain = sourceAsset.asset.chain
    const targetChain = targetAsset.asset.chain

    if (isChainOfThor(sourceChain) && isChainOfThor(targetChain)) {
      return right(thorchainPoolAssetDetails)
    }
    if (isChainOfMaya(sourceChain) && isChainOfMaya(targetChain)) {
      return mayachainPoolAssetDetails.length > 0
        ? right(mayachainPoolAssetDetails)
        : left(new Error(`MayaChain pool data unavailable for ${assetToString(sourceAsset.asset)}`))
    }
    if (isChainOfThor(sourceChain) && isChainOfMaya(targetChain)) {
      return mayachainPoolAssetDetails.length > 0
        ? right(mayachainPoolAssetDetails)
        : left(new Error(`MayaChain pool data unavailable for ${assetToString(targetAsset.asset)}`))
    }
    if (isChainOfMaya(sourceChain) && isChainOfThor(targetChain)) {
      return right(thorchainPoolAssetDetails)
    }
    // e.g. ETH↔NEAR (OneClick): neither side shares a Midgard DEX set
    return right([])
  }

  // Helper function to pick and validate pool assets.
  // Falls back to assets routable without THOR/MAYA pools (Chainflip + OneClick,
  // with zero RUNE-denominated price) so the swap UI loads when pool data is
  // unavailable or the pair only exists on a poolless protocol (e.g. SUI, ADA).
  // When Midgard is down, poolAssetDetails is often only the RUNE/CACAO stub —
  // still allow the selected pair through so aggregator quotes (Thornode /
  // Chainflip / 1Click) can run; USD prices stay 0 until Midgard recovers.
  const validatePoolAssets = (
    poolAssetDetails: PoolAssetDetail[],
    sourceAsset: AssetWithDecimal,
    targetAsset: AssetWithDecimal,
    poollessAssets: ReadonlyArray<AnyAsset>
  ): Either<Error, { sourceAssetDetail: PoolAssetDetail; targetAssetDetail: PoolAssetDetail }> => {
    const isProtocolStub = (asset: AnyAsset) =>
      (asset.chain === THORChain && asset.symbol === AssetRuneNative.symbol) ||
      (asset.chain === MAYAChain && asset.symbol === AssetCacao.symbol)
    const midgardPoolsUnavailable =
      poolAssetDetails.length === 0 || poolAssetDetails.every(({ asset }) => isProtocolStub(asset))

    const findFallback = (asset: AnyAsset): PoolAssetDetail | null => {
      const target = assetToString(asset)
      const match = poollessAssets.find((a) => assetToString(a) === target)
      if (match) return { asset: match, assetPrice: bn(0) }
      if (midgardPoolsUnavailable) return { asset, assetPrice: bn(0) }
      return null
    }
    const sourceAssetDetail =
      FP.pipe(Utils.pickPoolAsset(poolAssetDetails, sourceAsset.asset), O.toNullable) ?? findFallback(sourceAsset.asset)
    const targetAssetDetail =
      FP.pipe(Utils.pickPoolAsset(poolAssetDetails, targetAsset.asset), O.toNullable) ?? findFallback(targetAsset.asset)

    if (!sourceAssetDetail) {
      return left(new Error(`Missing pool for source asset ${assetToString(sourceAsset.asset)}`))
    }
    if (!targetAssetDetail) {
      return left(new Error(`Missing pool for target asset ${assetToString(targetAsset.asset)}`))
    }

    return right({ sourceAssetDetail, targetAssetDetail })
  }

  return (
    <>
      <div className="relative mb-4 flex items-center justify-between">
        <BackLinkButton className="absolute !m-0" />
        <h2 className="m-0 w-full text-center font-main-semi-bold text-16 text-turquoise uppercase">
          {intl.formatMessage({ id: 'common.swap' })}
        </h2>
        <RefreshButton className="absolute right-0" onClick={reloadHandler} />
      </div>
      {RD.isSuccess(tolerantPoolsStateMayaRD) ? (
        <div className="flex justify-center bg-bg0 dark:bg-bg0d">
          {FP.pipe(
            sequenceTRD(
              tolerantPoolsStateThorRD,
              tolerantPoolsStateMayaRD,
              sourceAssetRD,
              targetAssetRD,
              tolerantPendingPoolsStateRD,
              tolerantPendingPoolsStateMayaRD,
              chainFlipAssets
            ),
            RD.fold(
              () => <></>,
              () => <Spin className="min-h-24" tip={intl.formatMessage({ id: 'common.loading' })} />,
              renderError,
              ([
                { assetDetails: thorAssetDetails, poolsData: thorPoolsData, poolDetails: thorPoolDetails },
                { assetDetails: mayaAssetDetails, poolsData: mayaPoolsData, poolDetails: mayaPoolDetails },
                sourceAsset,
                targetAsset,
                pendingPools,
                pendingPoolsMaya
              ]) => {
                const combinedPoolsData = {
                  ...thorPoolsData,
                  ...mayaPoolsData
                }
                const thorchainPoolAssetDetails = [
                  { asset: AssetRuneNative, assetPrice: bn(1) },
                  ...thorAssetDetails,
                  ...pendingPools.assetDetails
                ]
                const mayachainPoolAssetDetails = [
                  { asset: AssetCacao, assetPrice: bn(1) },
                  ...mayaAssetDetails,
                  ...pendingPoolsMaya.assetDetails
                ]

                const assetData = RD.isSuccess(chainFlipAssets) ? chainFlipAssets.value : []

                // Convert assets and filter out unsupported chains
                const convertedAssets = assetData
                  .map(cAssetToXAsset)
                  .filter((asset): asset is XAsset | XTokenAsset => asset !== null)
                const poolAssetDetailsResult = getPoolAssetDetails(
                  sourceAsset,
                  targetAsset,
                  thorchainPoolAssetDetails,
                  mayachainPoolAssetDetails
                )

                if (isLeft(poolAssetDetailsResult)) {
                  return renderError(poolAssetDetailsResult.left)
                }

                const poolAssetDetails = poolAssetDetailsResult.right

                const assetValidationResult = validatePoolAssets(poolAssetDetails, sourceAsset, targetAsset, [
                  ...convertedAssets,
                  ...oneClickAssets
                ])
                if (isLeft(assetValidationResult)) {
                  return renderError(assetValidationResult.left)
                }

                const { sourceAssetDetail, targetAssetDetail } = assetValidationResult.right
                const poolAssets: AnyAsset[] = FP.pipe(
                  [...thorchainPoolAssetDetails, ...mayachainPoolAssetDetails],
                  A.map(({ asset }) => asset)
                )

                return (
                  <Swap
                    keystore={keystore}
                    validatePassword$={validatePassword$}
                    assets={{
                      source: { ...sourceAsset, price: sourceAssetDetail.assetPrice },
                      target: { ...targetAsset, price: targetAssetDetail.assetPrice }
                    }}
                    sourceKeystoreAddress={oSourceKeystoreAddress}
                    sourceLedgerAddress={oSourceLedgerAddress}
                    sourceWalletType={sourceWalletType}
                    targetWalletType={oTargetWalletType}
                    poolAddressMaya={selectedPoolAddressMaya}
                    poolAddressThor={selectedPoolAddressThor}
                    poolAssets={[...poolAssets, ...convertedAssets, ...oneClickAssets]}
                    poolsData={combinedPoolsData}
                    poolDetailsThor={thorPoolDetails}
                    poolDetailsMaya={mayaPoolDetails}
                    walletBalances={balancesState}
                    reloadFees={reloadSwapFees}
                    fees$={swapFees$}
                    reloadApproveFee={reloadApproveFee}
                    approveFee$={approveFee$}
                    targetKeystoreAddress={oTargetKeystoreAddress}
                    targetLedgerAddress={oTargetLedgerAddress}
                    recipientAddress={oRecipient}
                    swap$={swap$}
                    swapCF$={swapCF$}
                    swapOneClick$={swapOneClick$}
                    reloadBalances={reloadBalances}
                    onChangeAsset={onChangeAssetHandler}
                    network={network}
                    slipTolerance={slipTolerance}
                    changeSlipTolerance={changeStreamingSlipTolerance}
                    approveERC20Token$={approveERC20Token$}
                    isApprovedERC20Token$={isApprovedERC20Token$}
                    importWalletHandler={importWalletHandler}
                    addressValidator={validateSwapAddress}
                    hidePrivateData={isPrivate}
                    reloadTxStatus={reloadSwapTxStatus}
                    transactionTrackingService={transactionTrackingService}
                    mayaTransactionTrackingService={mayaTransactionTrackingService}
                  />
                )
              }
            )
          )}
        </div>
      ) : (
        <div className="flex justify-center bg-bg0 dark:bg-bg0d">
          {FP.pipe(
            sequenceTRD(
              tolerantPoolsStateThorRD,
              sourceAssetRD,
              targetAssetRD,
              tolerantPendingPoolsStateRD,
              chainFlipAssets
            ),
            RD.fold(
              () => <></>,
              () => <Spin className="min-h-24" tip={intl.formatMessage({ id: 'common.loading' })} />,
              renderError,
              ([
                { assetDetails: thorAssetDetails, poolsData: thorPoolsData, poolDetails: thorPoolDetails },
                sourceAsset,
                targetAsset,
                pendingPools
              ]) => {
                const thorchainPoolAssetDetails = [
                  { asset: AssetRuneNative, assetPrice: bn(1) },
                  ...thorAssetDetails,
                  ...pendingPools.assetDetails
                ]
                const assetData = RD.isSuccess(chainFlipAssets) ? chainFlipAssets.value : []

                // Convert assets and filter out unsupported chains
                const convertedAssets = assetData
                  .map(cAssetToXAsset)
                  .filter((asset): asset is XAsset | XTokenAsset => asset !== null)

                const assetValidationResult = validatePoolAssets(thorchainPoolAssetDetails, sourceAsset, targetAsset, [
                  ...convertedAssets,
                  ...oneClickAssets
                ])
                if (isLeft(assetValidationResult)) {
                  return renderError(assetValidationResult.left)
                }

                const { sourceAssetDetail, targetAssetDetail } = assetValidationResult.right

                const poolAssets: AnyAsset[] = FP.pipe(
                  [...thorchainPoolAssetDetails],
                  A.map(({ asset }) => asset)
                )

                return (
                  <Swap
                    keystore={keystore}
                    validatePassword$={validatePassword$}
                    assets={{
                      source: { ...sourceAsset, price: sourceAssetDetail.assetPrice },
                      target: { ...targetAsset, price: targetAssetDetail.assetPrice }
                    }}
                    sourceKeystoreAddress={oSourceKeystoreAddress}
                    sourceLedgerAddress={oSourceLedgerAddress}
                    sourceWalletType={sourceWalletType}
                    targetWalletType={oTargetWalletType}
                    poolAddressMaya={selectedPoolAddressMaya}
                    poolAddressThor={selectedPoolAddressThor}
                    poolAssets={[...poolAssets, ...convertedAssets, ...oneClickAssets]}
                    poolsData={thorPoolsData}
                    poolDetailsThor={thorPoolDetails}
                    poolDetailsMaya={[]}
                    walletBalances={balancesState}
                    reloadFees={reloadSwapFees}
                    fees$={swapFees$}
                    reloadApproveFee={reloadApproveFee}
                    approveFee$={approveFee$}
                    targetKeystoreAddress={oTargetKeystoreAddress}
                    targetLedgerAddress={oTargetLedgerAddress}
                    recipientAddress={oRecipient}
                    swap$={swap$}
                    swapCF$={swapCF$}
                    swapOneClick$={swapOneClick$}
                    reloadBalances={reloadBalances}
                    onChangeAsset={onChangeAssetHandler}
                    network={network}
                    slipTolerance={slipTolerance}
                    changeSlipTolerance={changeStreamingSlipTolerance}
                    approveERC20Token$={approveERC20Token$}
                    isApprovedERC20Token$={isApprovedERC20Token$}
                    importWalletHandler={importWalletHandler}
                    addressValidator={validateSwapAddress}
                    hidePrivateData={isPrivate}
                    reloadTxStatus={reloadSwapTxStatus}
                    transactionTrackingService={transactionTrackingService}
                    mayaTransactionTrackingService={mayaTransactionTrackingService}
                  />
                )
              }
            )
          )}
        </div>
      )}
    </>
  )
}

const SuccessTradeRouteView = ({
  sourceAsset,
  targetAsset,
  sourceWalletType,
  targetWalletType: oTargetWalletType,
  recipientAddress: oRecipientAddress
}: Props): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const location = useLocation()
  const { network } = useNetwork()
  const { service: midgardService } = useMidgardContext()
  const { service: midgardMayaService } = useMidgardMayaContext()
  const { protocol, setProtocol } = useApp()

  const {
    pools: { poolsState$, reloadPools, reloadSelectedPoolDetail, selectedPoolAddress$, haltedChains$ },
    setSelectedPoolAsset
  } = midgardService

  const {
    pools: {
      poolsState$: poolStateMaya$,
      reloadPools: reloadPoolsMaya,
      reloadSelectedPoolDetail: reloadSelectedPoolDetailMaya,
      selectedPoolAddress$: selectedPoolAddressMaya$,
      haltedChains$: haltedChainsMaya$
    },
    setSelectedPoolAsset: setSelectedPoolAssetMaya
  } = midgardMayaService

  const {
    balancesState$,
    reloadBalancesByChain,
    getLedgerAddress$,
    keystoreService: { keystoreState$, validatePassword$ }
  } = useWalletContext()
  const { reloadTxStatus, getTradeAccount$ } = useThorchainContext()
  const { getTradeAccount$: getTradeAccountMaya$ } = useMayachainContext()
  const [haltedChains] = useObservableState(
    () =>
      FP.pipe(protocol === THORChain ? haltedChains$ : haltedChainsMaya$, RxOp.map(RD.getOrElse((): Chain[] => []))),
    []
  )
  const { mimirHalt } = useThorchainMimirHalt()
  const { isPrivate } = useApp()
  const { thorchainQuery } = useThorchainQueryContext()
  const { mayachainQuery } = useMayachainQueryContext()
  const { tradeSlipTolerance$, changeTradeSlipTolerance } = useAppContext()

  const { chain: sourceChain } = protocol === THORChain ? AssetRuneNative : AssetCacao
  const { chain: targetChain } = protocol === THORChain ? AssetRuneNative : AssetCacao

  const selectedPoolAddressThor = useObservableState(selectedPoolAddress$, O.none)
  const selectedPoolAddressMaya = useObservableState(selectedPoolAddressMaya$, O.none)

  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(
    O.some(protocol === THORChain ? THORChain : MAYAChain)
  )

  const { reloadSwapFees, swapFees$, addressByChain$, swap$ } = useChainContext()

  const getStoredSlipTolerance = (key: string): SlipTolerance =>
    FP.pipe(
      localStorage.getItem(key),
      O.fromNullable,
      O.map((s) => {
        const itemAsNumber = Number(s)
        return isSlipTolerance(itemAsNumber) ? itemAsNumber : DEFAULT_SLIP_TOLERANCE
      }),
      O.getOrElse(() => DEFAULT_SLIP_TOLERANCE)
    )

  const tradeSlipTolerance = useObservableState<SlipTolerance>(
    tradeSlipTolerance$,
    getStoredSlipTolerance(`${SLIP_TOLERANCE_KEY}_TRADE`)
  )

  const poolsStateRD = useObservableState(poolsState$, RD.initial)
  const poolsStateMayaRD = useObservableState(poolStateMaya$, RD.initial)

  const tradeThorPoolDetails = RD.isSuccess(poolsStateRD) ? poolsStateRD.value.poolDetails : undefined
  const tradeMayaPoolDetails = RD.isSuccess(poolsStateMayaRD) ? poolsStateMayaRD.value.poolDetails : undefined

  const sourceAssetRD: AssetWithDecimalRD = useMemo(
    () => assetDecimalRD(sourceAsset, tradeThorPoolDetails, tradeMayaPoolDetails),
    [sourceAsset, tradeMayaPoolDetails, tradeThorPoolDetails]
  )

  const targetAssetRD: AssetWithDecimalRD = useMemo(
    () => assetDecimalRD(targetAsset, tradeThorPoolDetails, tradeMayaPoolDetails),
    [targetAsset, tradeMayaPoolDetails, tradeThorPoolDetails]
  )

  const [balancesStateThor] = useObservableState(
    () =>
      balancesState$({
        [THORChain]: 'all'
      }),
    INITIAL_BALANCES_STATE
  )
  const [balancesStateMaya] = useObservableState(
    () =>
      balancesState$({
        [MAYAChain]: 'all'
      }),
    INITIAL_BALANCES_STATE
  )
  const balancesState = protocol === THORChain ? balancesStateThor : balancesStateMaya

  const onChangeAssetHandler = useCallback(
    ({
      source,
      sourceWalletType,
      target,
      targetWalletType: oTargetWalletType,
      recipientAddress: oRecipientAddress
    }: {
      source: AnyAsset
      target: AnyAsset
      sourceWalletType: WalletType
      targetWalletType: O.Option<WalletType>
      recipientAddress: O.Option<Address>
    }) => {
      const targetWalletType = FP.pipe(
        oTargetWalletType,
        O.getOrElse<SwapRouteTargetWalletType>(() => 'custom')
      )
      const recipient = FP.pipe(oRecipientAddress, O.toUndefined)
      const path = swap.path({
        source: assetToString(source),
        sourceWalletType,
        target: assetToString(target),
        targetWalletType,
        recipient
      })
      navigate(path, { replace: true })
    },
    [navigate]
  )

  useEffect(() => {
    // Source asset is the asset of the pool we need to interact with
    // Store it in global state, all depending streams will be updated then
    if (sourceAsset === AssetRuneNative && protocol === MAYAChain) {
      setProtocol(THORChain)
    }
    if (sourceAsset === AssetCacao && protocol === THORChain) {
      setProtocol(MAYAChain)
    }

    setSelectedPoolAsset(O.some(sourceAsset))
    setSelectedPoolAssetMaya(O.some(sourceAsset))
    // Reset selectedPoolAsset on view's unmount to avoid effects with depending streams
    return () => {
      setSelectedPoolAsset(O.none)
    }
  }, [sourceAsset, setSelectedPoolAsset, targetAsset, setSelectedPoolAssetMaya, protocol, setProtocol])

  const keystore = useObservableState(keystoreState$, O.none)

  const importWalletHandler = useCallback(() => {
    navigate(walletRoutes.base.path(location.pathname))
  }, [location.pathname, navigate])

  const reloadHandler = useCallback(() => {
    if (protocol === THORChain) {
      reloadBalancesByChain(THORChain, sourceWalletType)
      reloadPools()
      reloadSelectedPoolDetail()
    } else {
      reloadBalancesByChain(MAYAChain, sourceWalletType)
      reloadPoolsMaya()
      reloadSelectedPoolDetailMaya()
    }
  }, [
    protocol,
    reloadBalancesByChain,
    reloadPools,
    reloadPoolsMaya,
    reloadSelectedPoolDetail,
    reloadSelectedPoolDetailMaya,
    sourceWalletType
  ])

  const [oTargetLedgerAddress, updateTargetLedgerAddress$] = useObservableState<O.Option<Address>, UpdateLedgerAddress>(
    (targetLedgerAddressChain$) =>
      FP.pipe(
        targetLedgerAddressChain$,
        RxOp.distinctUntilChanged(eqUpdateLedgerAddress.equals),
        RxOp.switchMap(({ chain }) => getLedgerAddress$(chain)),
        RxOp.map(O.map(ledgerAddressToWalletAddress)),
        RxOp.map(addressFromOptionalWalletAddress)
      ),
    O.none
  )

  useEffect(() => {
    updateTargetLedgerAddress$({ chain: targetChain, network })
  }, [network, targetChain, updateTargetLedgerAddress$])

  const [oSourceKeystoreAddress, updateSourceKeystoreAddress$] = useObservableState<O.Option<Address>, Chain>(
    (sourceChain$) =>
      FP.pipe(
        sourceChain$,
        RxOp.distinctUntilChanged(eqChain.equals),
        RxOp.switchMap(addressByChain$),
        RxOp.map(addressFromOptionalWalletAddress)
      ),
    O.none
  )

  const [oSourceLedgerAddress, updateSourceLedgerAddress$] = useObservableState<O.Option<Address>, UpdateLedgerAddress>(
    (sourceLedgerAddressChain$) =>
      FP.pipe(
        sourceLedgerAddressChain$,
        RxOp.distinctUntilChanged(eqUpdateLedgerAddress.equals),
        RxOp.switchMap(({ chain }) => {
          return getLedgerAddress$(chain)
        }),
        RxOp.map(O.map(ledgerAddressToWalletAddress)),
        RxOp.map(addressFromOptionalWalletAddress)
      ),
    O.none
  )

  useEffect(() => {
    updateSourceLedgerAddress$({ chain: sourceChain, network })
  }, [network, sourceChain, updateSourceLedgerAddress$])

  useEffect(() => {
    updateSourceKeystoreAddress$(sourceChain)
  }, [sourceChain, updateSourceKeystoreAddress$])

  const [oTargetKeystoreAddress, updateTargetKeystoreAddress$] = useObservableState<O.Option<Address>, Chain>(
    (targetChain$) =>
      FP.pipe(
        targetChain$,
        RxOp.distinctUntilChanged(eqChain.equals),
        RxOp.switchMap(addressByChain$),
        RxOp.map(addressFromOptionalWalletAddress)
      ),
    O.none
  )

  useEffect(() => {
    updateTargetKeystoreAddress$(targetChain)
  }, [targetChain, updateTargetKeystoreAddress$])

  const isTargetLedger = FP.pipe(
    oTargetWalletType,
    O.map(isLedgerWallet),
    O.getOrElse(() => false)
  )

  const oRecipient: O.Option<Address> = FP.pipe(
    oRecipientAddress,
    O.fromPredicate(O.isSome),
    O.flatten,
    O.alt(() => (isTargetLedger ? oTargetLedgerAddress : oTargetKeystoreAddress))
  )
  const reloadSwapTxStatus = useCallback(() => {
    reloadTxStatus()
  }, [reloadTxStatus])

  const reloadBalances = useCallback(() => {
    reloadBalancesByChain(sourceChain, sourceWalletType)()
  }, [reloadBalancesByChain, sourceChain, sourceWalletType])

  const renderError = useCallback(
    (e: Error) => (
      <ErrorView
        title={intl.formatMessage({ id: 'common.error' })}
        subTitle={e?.message ?? e.toString()}
        extra={<Button onClick={reloadPools}>{intl.formatMessage({ id: 'common.retry' })}</Button>}
      />
    ),
    [intl, reloadPools]
  )

  const [tradeAccountBalanceRD, setTradeAccountBalanceRD] = useState<RD.RemoteData<Error, TradeAccount[]>>(RD.pending)

  useEffect(() => {
    let subscription: Rx.Subscription | undefined
    FP.pipe(
      sourceWalletType === WalletType.Keystore ? oSourceKeystoreAddress : oSourceLedgerAddress,
      O.fold(
        () => setTradeAccountBalanceRD(RD.initial),
        (sourceAddress) => {
          setTradeAccountBalanceRD(RD.pending)
          const stream$ =
            protocol === THORChain
              ? getTradeAccount$(sourceAddress, sourceWalletType)
              : getTradeAccountMaya$(sourceAddress, sourceWalletType)
          subscription = stream$.subscribe((result) => {
            setTradeAccountBalanceRD(result)
          })
        }
      )
    )
    return () => subscription?.unsubscribe()
  }, [getTradeAccount$, getTradeAccountMaya$, oSourceKeystoreAddress, oSourceLedgerAddress, protocol, sourceWalletType])

  const { validateSwapAddress } = useValidateAddress(targetChain)
  return (
    <>
      <div className="relative mb-4 flex items-center justify-between">
        <BackLinkButton className="absolute !m-0" />
        <h2 className="m-0 w-full text-center font-main-semi-bold text-16 text-turquoise uppercase">
          {intl.formatMessage({ id: 'common.swap' })}
        </h2>
        <RefreshButton className="absolute right-0" onClick={reloadHandler} />
      </div>
      {RD.isSuccess(poolsStateMayaRD) ? (
        <div className="flex justify-center bg-bg0 dark:bg-bg0d">
          {FP.pipe(
            sequenceTRD(poolsStateRD, poolsStateMayaRD, sourceAssetRD, targetAssetRD),
            RD.fold(
              () => <></>,
              () => {
                const mockAssetSource: SwapAsset = {
                  asset: sourceAsset,
                  decimal: 18,
                  price: baseAmount(0).amount()
                }

                const mockAssetTarget: SwapAsset = {
                  asset: targetAsset,
                  decimal: 18,
                  price: baseAmount(0).amount()
                }

                return (
                  <TradeSwap
                    disableSwapAction={true}
                    keystore={keystore}
                    validatePassword$={validatePassword$}
                    goToTransaction={openExplorerTxUrl}
                    getExplorerTxUrl={getExplorerTxUrl}
                    assets={{
                      source: mockAssetSource,

                      target: mockAssetTarget
                    }}
                    sourceKeystoreAddress={oSourceKeystoreAddress}
                    sourceLedgerAddress={oSourceLedgerAddress}
                    sourceWalletType={sourceWalletType}
                    targetWalletType={oTargetWalletType}
                    poolAddressThor={selectedPoolAddressThor}
                    poolAddressMaya={selectedPoolAddressMaya}
                    poolAssets={[]}
                    poolsData={{}}
                    poolsDataMaya={{}}
                    poolDetails={[]}
                    poolDetailsMaya={[]}
                    walletBalances={balancesState}
                    reloadFees={reloadSwapFees}
                    fees$={swapFees$}
                    targetKeystoreAddress={oTargetKeystoreAddress}
                    targetLedgerAddress={oTargetLedgerAddress}
                    recipientAddress={oRecipient}
                    swap$={swap$}
                    reloadBalances={reloadBalances}
                    onChangeAsset={onChangeAssetHandler}
                    network={network}
                    importWalletHandler={importWalletHandler}
                    addressValidator={validateSwapAddress}
                    hidePrivateData={isPrivate}
                    thorchainQuery={thorchainQuery}
                    mayachainQuery={mayachainQuery}
                    reloadTxStatus={reloadSwapTxStatus}
                    slipTolerance={tradeSlipTolerance}
                    changeSlipTolerance={changeTradeSlipTolerance}
                    tradeAccountBalances={tradeAccountBalanceRD}
                    protocol={protocol}
                  />
                )
              },
              renderError,
              ([
                { assetDetails, poolsData, poolDetails },
                { assetDetails: assetDetailsMaya, poolsData: poolsDataMaya, poolDetails: poolDetailsMaya },
                sourceAsset,
                targetAsset
              ]) => {
                const combinedAssetDetails = protocol === THORChain ? [...assetDetails] : [...assetDetailsMaya]

                const assets = FP.pipe(
                  combinedAssetDetails,
                  A.map(({ asset }) => asset)
                )

                const hasRuneAsset = assetInList(AssetRuneNative)(assets)
                const hasCacaoAsset = assetInList(AssetCacao)(assets)

                // Create updated assetDetails immutably
                const updatedAssetDetails = [
                  ...(!hasRuneAsset ? [{ asset: AssetRuneNative, assetPrice: bn(1) }] : []),
                  ...(!hasCacaoAsset ? [{ asset: AssetCacao, assetPrice: bn(1) }] : []),
                  ...combinedAssetDetails
                ]
                const sourceAssetDetail = FP.pipe(
                  Utils.pickPoolAsset(updatedAssetDetails, sourceAsset.asset),
                  O.toNullable
                )
                // Make sure sourceAsset is available in pools
                if (!sourceAssetDetail)
                  return renderError(Error(`Missing pool for source asset ${assetToString(sourceAsset.asset)}`))
                const targetAssetDetail = FP.pipe(
                  Utils.pickPoolAsset(updatedAssetDetails, targetAsset.asset),
                  O.toNullable
                )
                // Make sure targetAsset is available in pools
                if (!targetAssetDetail)
                  return renderError(Error(`Missing pool for target asset ${assetToString(targetAsset.asset)}`))

                const poolAssets: AnyAsset[] = FP.pipe(
                  updatedAssetDetails,
                  A.map(({ asset }) => asset)
                )
                const disableAllPoolActions = (chain: Chain) =>
                  PoolHelpers.disableAllActions({ chain, haltedChains, mimirHalt })

                const disableTradingPoolActions = (chain: Chain) =>
                  PoolHelpers.disableTradingActions({ chain, haltedChains, mimirHalt })

                const checkDisableSwapAction = () => {
                  return (
                    disableAllPoolActions(sourceAsset.asset.chain) ||
                    disableTradingPoolActions(sourceAsset.asset.chain) ||
                    disableAllPoolActions(targetAsset.asset.chain) ||
                    disableTradingPoolActions(targetAsset.asset.chain)
                  )
                }

                return (
                  <TradeSwap
                    disableSwapAction={checkDisableSwapAction()}
                    keystore={keystore}
                    validatePassword$={validatePassword$}
                    goToTransaction={openExplorerTxUrl}
                    getExplorerTxUrl={getExplorerTxUrl}
                    assets={{
                      source: { ...sourceAsset, price: sourceAssetDetail.assetPrice },
                      target: { ...targetAsset, price: targetAssetDetail.assetPrice }
                    }}
                    sourceKeystoreAddress={oSourceKeystoreAddress}
                    sourceLedgerAddress={oSourceLedgerAddress}
                    sourceWalletType={sourceWalletType}
                    targetWalletType={oTargetWalletType}
                    poolAddressThor={selectedPoolAddressThor}
                    poolAddressMaya={selectedPoolAddressMaya}
                    poolAssets={poolAssets}
                    poolsData={poolsData}
                    poolsDataMaya={poolsDataMaya}
                    poolDetails={poolDetails}
                    poolDetailsMaya={poolDetailsMaya}
                    walletBalances={balancesState}
                    reloadFees={reloadSwapFees}
                    fees$={swapFees$}
                    targetKeystoreAddress={oTargetKeystoreAddress}
                    targetLedgerAddress={oTargetLedgerAddress}
                    recipientAddress={oRecipient}
                    swap$={swap$}
                    reloadBalances={reloadBalances}
                    onChangeAsset={onChangeAssetHandler}
                    network={network}
                    importWalletHandler={importWalletHandler}
                    addressValidator={validateSwapAddress}
                    hidePrivateData={isPrivate}
                    thorchainQuery={thorchainQuery}
                    mayachainQuery={mayachainQuery}
                    reloadTxStatus={reloadSwapTxStatus}
                    slipTolerance={tradeSlipTolerance}
                    changeSlipTolerance={changeTradeSlipTolerance}
                    tradeAccountBalances={tradeAccountBalanceRD}
                    protocol={protocol}
                  />
                )
              }
            )
          )}
        </div>
      ) : (
        <div className="flex justify-center bg-bg0 dark:bg-bg0d">
          {FP.pipe(
            sequenceTRD(poolsStateRD, sourceAssetRD, targetAssetRD),
            RD.fold(
              () => <></>,
              () => {
                const mockAssetSource: SwapAsset = {
                  asset: sourceAsset,
                  decimal: 18,
                  price: baseAmount(0).amount()
                }

                const mockAssetTarget: SwapAsset = {
                  asset: targetAsset,
                  decimal: 18,
                  price: baseAmount(0).amount()
                }

                return (
                  <TradeSwap
                    disableSwapAction={true}
                    keystore={keystore}
                    validatePassword$={validatePassword$}
                    goToTransaction={openExplorerTxUrl}
                    getExplorerTxUrl={getExplorerTxUrl}
                    assets={{
                      source: mockAssetSource,

                      target: mockAssetTarget
                    }}
                    sourceKeystoreAddress={oSourceKeystoreAddress}
                    sourceLedgerAddress={oSourceLedgerAddress}
                    sourceWalletType={sourceWalletType}
                    targetWalletType={oTargetWalletType}
                    poolAddressThor={selectedPoolAddressThor}
                    poolAddressMaya={selectedPoolAddressMaya}
                    poolAssets={[]}
                    poolsData={{}}
                    poolsDataMaya={{}}
                    poolDetails={[]}
                    poolDetailsMaya={[]}
                    walletBalances={balancesState}
                    reloadFees={reloadSwapFees}
                    fees$={swapFees$}
                    targetKeystoreAddress={oTargetKeystoreAddress}
                    targetLedgerAddress={oTargetLedgerAddress}
                    recipientAddress={oRecipient}
                    swap$={swap$}
                    reloadBalances={reloadBalances}
                    onChangeAsset={onChangeAssetHandler}
                    network={network}
                    importWalletHandler={importWalletHandler}
                    addressValidator={validateSwapAddress}
                    hidePrivateData={isPrivate}
                    thorchainQuery={thorchainQuery}
                    mayachainQuery={mayachainQuery}
                    reloadTxStatus={reloadSwapTxStatus}
                    slipTolerance={tradeSlipTolerance}
                    changeSlipTolerance={changeTradeSlipTolerance}
                    tradeAccountBalances={tradeAccountBalanceRD}
                    protocol={protocol}
                  />
                )
              },
              renderError,
              ([{ assetDetails, poolsData, poolDetails }, sourceAsset, targetAsset]) => {
                const combinedAssetDetails = [...assetDetails]

                const hasRuneAsset = FP.pipe(
                  combinedAssetDetails,
                  A.map(({ asset }) => asset),
                  assetInList(AssetRuneNative)
                )
                if (!hasRuneAsset) {
                  assetDetails = [{ asset: AssetRuneNative, assetPrice: bn(1) }, ...combinedAssetDetails]
                }
                const sourceAssetDetail = FP.pipe(Utils.pickPoolAsset(assetDetails, sourceAsset.asset), O.toNullable)
                // Make sure sourceAsset is available in pools
                if (!sourceAssetDetail)
                  return renderError(Error(`Missing pool for source asset ${assetToString(sourceAsset.asset)}`))
                const targetAssetDetail = FP.pipe(Utils.pickPoolAsset(assetDetails, targetAsset.asset), O.toNullable)
                // Make sure targetAsset is available in pools
                if (!targetAssetDetail)
                  return renderError(Error(`Missing pool for target asset ${assetToString(targetAsset.asset)}`))

                const poolAssets: AnyAsset[] = FP.pipe(
                  assetDetails,
                  A.map(({ asset }) => asset)
                )
                const disableAllPoolActions = (chain: Chain) =>
                  PoolHelpers.disableAllActions({ chain, haltedChains, mimirHalt })

                const disableTradingPoolActions = (chain: Chain) =>
                  PoolHelpers.disableTradingActions({ chain, haltedChains, mimirHalt })

                const checkDisableSwapAction = () => {
                  return (
                    disableAllPoolActions(sourceAsset.asset.chain) ||
                    disableTradingPoolActions(sourceAsset.asset.chain) ||
                    disableAllPoolActions(targetAsset.asset.chain) ||
                    disableTradingPoolActions(targetAsset.asset.chain)
                  )
                }

                return (
                  <TradeSwap
                    disableSwapAction={checkDisableSwapAction()}
                    keystore={keystore}
                    validatePassword$={validatePassword$}
                    goToTransaction={openExplorerTxUrl}
                    getExplorerTxUrl={getExplorerTxUrl}
                    assets={{
                      source: { ...sourceAsset, price: sourceAssetDetail.assetPrice },
                      target: { ...targetAsset, price: targetAssetDetail.assetPrice }
                    }}
                    sourceKeystoreAddress={oSourceKeystoreAddress}
                    sourceLedgerAddress={oSourceLedgerAddress}
                    sourceWalletType={sourceWalletType}
                    targetWalletType={oTargetWalletType}
                    poolAddressThor={selectedPoolAddressThor}
                    poolAddressMaya={selectedPoolAddressMaya}
                    poolAssets={poolAssets}
                    poolsData={poolsData}
                    poolsDataMaya={{}}
                    poolDetails={poolDetails}
                    poolDetailsMaya={[]}
                    walletBalances={balancesState}
                    reloadFees={reloadSwapFees}
                    fees$={swapFees$}
                    targetKeystoreAddress={oTargetKeystoreAddress}
                    targetLedgerAddress={oTargetLedgerAddress}
                    recipientAddress={oRecipient}
                    swap$={swap$}
                    reloadBalances={reloadBalances}
                    onChangeAsset={onChangeAssetHandler}
                    network={network}
                    importWalletHandler={importWalletHandler}
                    addressValidator={validateSwapAddress}
                    hidePrivateData={isPrivate}
                    thorchainQuery={thorchainQuery}
                    mayachainQuery={mayachainQuery}
                    reloadTxStatus={reloadSwapTxStatus}
                    slipTolerance={tradeSlipTolerance}
                    changeSlipTolerance={changeTradeSlipTolerance}
                    tradeAccountBalances={tradeAccountBalanceRD}
                    protocol={protocol}
                  />
                )
              }
            )
          )}
        </div>
      )}
    </>
  )
}

export const SwapView = (): JSX.Element => {
  const {
    source,
    target,
    sourceWalletType: routeSourceWalletType,
    targetWalletType: routeTargetWalletType,
    recipient
  } = useParams<SwapRouteParams>()
  const sourceAssetString = source && source.match('_synth_') ? source.replace('_synth_', '/') : source
  const targetAssetString = target && target.match('_synth_') ? target.replace('_synth_', '/') : target

  const oSourceAsset: O.Option<AnyAsset> = useMemo(
    () => getAssetFromNullableString(sourceAssetString),
    [sourceAssetString]
  )

  const oTargetAsset: O.Option<AnyAsset> = useMemo(() => {
    const asset = getAssetFromNullableString(targetAssetString)
    return asset
  }, [targetAssetString])

  const oRecipientAddress: O.Option<Address> = useMemo(() => getWalletAddressFromNullableString(recipient), [recipient])
  const sourceWalletType = routeSourceWalletType || DEFAULT_WALLET_TYPE
  const oTargetWalletType = FP.pipe(routeTargetWalletType, O.fromPredicate(isWalletType))
  const intl = useIntl()

  return FP.pipe(
    sequenceTOption(oSourceAsset, oTargetAsset),
    O.fold(
      () => (
        <ErrorView
          title={intl.formatMessage(
            { id: 'routes.invalid.params' },
            {
              params: `source: ${source}, target: ${target}`
            }
          )}
        />
      ),
      ([sourceAsset, targetAsset]) =>
        sourceAsset.type !== AssetType.TRADE && targetAsset.type !== AssetType.TRADE ? (
          <SuccessRouteView
            sourceAsset={sourceAsset}
            targetAsset={targetAsset}
            sourceWalletType={sourceWalletType}
            targetWalletType={oTargetWalletType}
            recipientAddress={oRecipientAddress}
          />
        ) : (
          <SuccessTradeRouteView
            sourceAsset={sourceAsset}
            targetAsset={targetAsset}
            sourceWalletType={sourceWalletType}
            targetWalletType={oTargetWalletType}
            recipientAddress={oRecipientAddress}
          />
        )
    )
  )
}
