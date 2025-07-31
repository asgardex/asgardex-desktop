import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { ThorChain } from '@xchainjs/xchain-mayachain-query'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, assetToString, bn, Chain, baseAmount, AnyAsset, AssetType } from '@xchainjs/xchain-util'
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
import { isLedgerWallet, isWalletType } from '../../../shared/utils/guard'
import { WalletType } from '../../../shared/wallet/types'
import { ErrorView } from '../../components/shared/error/'
import { Spin } from '../../components/shared/loading'
import { Swap, TradeSwap } from '../../components/swap'
import { SLIP_TOLERANCE_KEY } from '../../components/swap/SelectableSlipTolerance'
import { SwapAsset } from '../../components/swap/Swap.types'
import * as Utils from '../../components/swap/Swap.utils'
import { BackLinkButton, Button, RefreshButton } from '../../components/uielements/button'
import { DEFAULT_WALLET_TYPE } from '../../const'
import { useAppContext } from '../../contexts/AppContext'
import { useChainContext } from '../../contexts/ChainContext'
import { useChainflipContext } from '../../contexts/ChainflipContext'
import { useEvmContext } from '../../contexts/EvmContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useThorchainQueryContext } from '../../contexts/ThorchainQueryContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { assetInList, getAssetFromNullableString } from '../../helpers/assetHelper'
import { eqChain, eqNetwork } from '../../helpers/fp/eq'
import { sequenceTOption, sequenceTRD } from '../../helpers/fpHelpers'
import * as PoolHelpers from '../../helpers/poolHelper'
import { addressFromOptionalWalletAddress, getWalletAddressFromNullableString } from '../../helpers/walletHelper'
import { useThorchainMimirHalt } from '../../hooks/useMimirHalt'
import { useNetwork } from '../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../hooks/useOpenExplorerTxUrl'
import { usePricePool } from '../../hooks/usePricePool'
import { useValidateAddress } from '../../hooks/useValidateAddress'
import { swap } from '../../routes/pools'
import { SwapRouteParams, SwapRouteTargetWalletType } from '../../routes/pools/swap'
import * as walletRoutes from '../../routes/wallet'
import { getDecimal } from '../../services/chain/decimal'
import { AssetWithDecimalLD, AssetWithDecimalRD } from '../../services/chain/types'
import { cAssetToXAsset, cChainToXChain } from '../../services/chainflip/utils'
import { DEFAULT_SLIP_TOLERANCE } from '../../services/const'
import { PoolAssetDetail } from '../../services/midgard/midgardTypes'
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

  const { reloadInboundAddresses, reloadTxStatus } = useThorchainContext()
  const { reloadInboundAddresses: reloadMayaInboundAddresses } = useMayachainContext()

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
    healthStatus$,
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
    healthStatus$: healthStatusMaya$,
    setSelectedPoolAsset: setSelectedPoolAssetMaya
  } = midgardMayaService

  const { isPrivate } = useApp()

  const midgardMayaStatusRD = useObservableState(healthStatusMaya$, RD.initial)
  const midgardStatusRD = useObservableState(healthStatus$, RD.initial)

  const { getAssetsData$ } = useChainflipContext()

  const [chainFlipAssets] = useObservableState(() => getAssetsData$(), RD.pending)

  const { reloadSwapFees, swapFees$, addressByChain$, swap$, assetWithDecimal$, swapCF$ } = useChainContext()

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

  const sourceAssetDecimal$: AssetWithDecimalLD = useMemo(() => {
    // Check the condition to skip fetching
    if (sourceAsset.type === AssetType.SECURED) {
      // Resolve `getDecimal` and return the observable
      return Rx.from(getDecimal(AssetRuneNative)).pipe(
        RxOp.map((decimal) =>
          RD.success({
            asset: sourceAsset,
            decimal
          })
        ),
        RxOp.catchError((error) => Rx.of(RD.failure(error?.msg ?? error.toString()))),
        RxOp.startWith(RD.pending)
      )
    }
    // Check the condition to skip fetching
    if (sourceAsset.type === AssetType.SYNTH) {
      // Resolve `getDecimal` and return the observable
      return Rx.from(getDecimal(AssetCacao)).pipe(
        RxOp.map((decimal) =>
          RD.success({
            asset: sourceAsset,
            decimal
          })
        ),
        RxOp.catchError((error) => Rx.of(RD.failure(error?.msg ?? error.toString()))),
        RxOp.startWith(RD.pending)
      )
    }
    // Check if chainFlipAssets is available and contains the sourceAsset
    if (RD.isSuccess(chainFlipAssets)) {
      const matchingAsset = chainFlipAssets.value.find(
        (asset) => cChainToXChain(asset.chain) === sourceAsset.chain && asset.asset === sourceAsset.ticker
      )
      if (matchingAsset) {
        // If a matching asset is found, return its decimal value
        return Rx.of(
          RD.success({
            asset: sourceAsset,
            decimal: matchingAsset.decimals
          })
        )
      }
    }
    // Use the existing `assetWithDecimal$` function for fetching
    return assetWithDecimal$(sourceAsset)
  }, [assetWithDecimal$, chainFlipAssets, sourceAsset])

  const sourceAssetRD: AssetWithDecimalRD = useObservableState(sourceAssetDecimal$, RD.initial)

  const targetAssetDecimal$: AssetWithDecimalLD = useMemo(() => {
    if (targetAsset.type === AssetType.SYNTH) {
      // Return a default `LiveData` if the condition is met
      return Rx.from(getDecimal(AssetCacao)).pipe(
        RxOp.map((decimal) =>
          RD.success({
            asset: targetAsset,
            decimal
          })
        ),
        RxOp.catchError((error) => Rx.of(RD.failure(error?.msg ?? error.toString()))),
        RxOp.startWith(RD.pending)
      )
    }
    if (targetAsset.type === AssetType.SECURED) {
      // Return a default `LiveData` if the condition is met
      return Rx.from(getDecimal(AssetRuneNative)).pipe(
        RxOp.map((decimal) =>
          RD.success({
            asset: targetAsset,
            decimal
          })
        ),
        RxOp.catchError((error) => Rx.of(RD.failure(error?.msg ?? error.toString()))),
        RxOp.startWith(RD.pending)
      )
    }

    // Otherwise, fetch the actual assetWithDecimal
    return assetWithDecimal$(targetAsset)
  }, [assetWithDecimal$, targetAsset])

  const targetAssetRD: AssetWithDecimalRD = useObservableState(targetAssetDecimal$, RD.initial)

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

  // Helper function to determine pool set
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
    return left(new Error(`Unsupported chain combination: source (${sourceChain}), target (${targetChain})`))
  }

  // Helper function to pick and validate pool assets
  const validatePoolAssets = (
    poolAssetDetails: PoolAssetDetail[],
    sourceAsset: AssetWithDecimal,
    targetAsset: AssetWithDecimal
  ): Either<Error, { sourceAssetDetail: PoolAssetDetail; targetAssetDetail: PoolAssetDetail }> => {
    const sourceAssetDetail = FP.pipe(Utils.pickPoolAsset(poolAssetDetails, sourceAsset.asset), O.toNullable)
    const targetAssetDetail = FP.pipe(Utils.pickPoolAsset(poolAssetDetails, targetAsset.asset), O.toNullable)

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
        <h2 className="m-0 w-full text-center font-mainSemiBold text-16 uppercase text-turquoise">
          {intl.formatMessage({ id: 'common.swap' })}
        </h2>
        <RefreshButton className="absolute right-0" onClick={reloadHandler} />
      </div>
      {RD.isSuccess(poolsStateMayaRD) ? (
        <div className="flex justify-center bg-bg0 dark:bg-bg0d">
          {FP.pipe(
            sequenceTRD(
              poolsStateThorRD,
              poolsStateMayaRD,
              sourceAssetRD,
              targetAssetRD,
              pendingPoolsStateRD,
              pendingPoolsStateMayaRD,
              chainFlipAssets
            ),
            RD.fold(
              () => <></>,
              () => (
                <>
                  <Spin tip="Loading...">
                    <div className="min-h-24" />
                  </Spin>
                </>
              ),
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
                  .map(cAssetToXAsset) // Apply the conversion function
                  .filter((asset) => asset.chain !== 'POL') // Remove assets with unsupported chain
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

                const assetValidationResult = validatePoolAssets(poolAssetDetails, sourceAsset, targetAsset)
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
                    poolAssets={[...poolAssets, ...convertedAssets]}
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
                    midgardStatusRD={midgardStatusRD}
                    midgardStatusMayaRD={midgardMayaStatusRD}
                  />
                )
              }
            )
          )}
        </div>
      ) : (
        <div className="flex justify-center bg-bg0 dark:bg-bg0d">
          {FP.pipe(
            sequenceTRD(poolsStateThorRD, sourceAssetRD, targetAssetRD, pendingPoolsStateRD, chainFlipAssets),
            RD.fold(
              () => <></>,
              () => (
                <>
                  <Spin tip="Loading...">
                    <div className="min-h-24" />
                  </Spin>
                </>
              ),
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
                const convertedAssets = assetData.map(cAssetToXAsset).filter((asset) => asset.chain !== 'POL')

                const assetValidationResult = validatePoolAssets(thorchainPoolAssetDetails, sourceAsset, targetAsset)
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
                    poolAssets={[...poolAssets, ...convertedAssets]}
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
                    midgardStatusRD={midgardStatusRD}
                    midgardStatusMayaRD={midgardMayaStatusRD}
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
  const {
    pools: {
      poolsState$,
      reloadPools,
      reloadSelectedPoolDetail,
      selectedPoolAddress$,
      haltedChains$,
      pendingPoolsState$
    },
    setSelectedPoolAsset
  } = midgardService

  const {
    balancesState$,
    reloadBalancesByChain,
    getLedgerAddress$,
    keystoreService: { keystoreState$, validatePassword$ }
  } = useWalletContext()
  const { reloadTxStatus, getTradeAccount$ } = useThorchainContext()
  const [haltedChains] = useObservableState(() => FP.pipe(haltedChains$, RxOp.map(RD.getOrElse((): Chain[] => []))), [])
  const { mimirHalt } = useThorchainMimirHalt()
  const pricePool = usePricePool()
  const { isPrivate } = useApp()
  const { thorchainQuery } = useThorchainQueryContext()
  const { tradeSlipTolerance$, changeTradeSlipTolerance } = useAppContext()

  // all trades will be using THorchain
  const { chain: sourceChain } = AssetRuneNative
  const { chain: targetChain } = AssetRuneNative

  const selectedPoolAddress = useObservableState(selectedPoolAddress$, O.none)

  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(ThorChain))

  const { reloadSwapFees, swapFees$, addressByChain$, swap$, assetWithDecimal$ } = useChainContext()

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

  const sourceAssetDecimal$: AssetWithDecimalLD = useMemo(() => {
    // Check the condition to skip fetching
    if (sourceAsset.type === AssetType.TRADE) {
      // Resolve `getDecimal` and return the observable
      return Rx.from(getDecimal(AssetRuneNative)).pipe(
        RxOp.map((decimal) =>
          RD.success({
            asset: sourceAsset,
            decimal
          })
        ),
        RxOp.catchError((error) => Rx.of(RD.failure(error?.msg ?? error.toString()))),
        RxOp.startWith(RD.pending)
      )
    }

    // Use the existing `assetWithDecimal$` function for fetching
    return assetWithDecimal$(sourceAsset)
  }, [assetWithDecimal$, sourceAsset])

  const sourceAssetRD: AssetWithDecimalRD = useObservableState(sourceAssetDecimal$, RD.initial)

  const targetAssetDecimal$: AssetWithDecimalLD = useMemo(() => {
    if (targetAsset.type === AssetType.TRADE) {
      // Return a default `LiveData` if the condition is met
      return Rx.from(getDecimal(AssetRuneNative)).pipe(
        RxOp.map((decimal) =>
          RD.success({
            asset: targetAsset,
            decimal
          })
        ),
        RxOp.catchError((error) => Rx.of(RD.failure(error?.msg ?? error.toString()))),
        RxOp.startWith(RD.pending)
      )
    }

    // Otherwise, fetch the actual assetWithDecimal
    return assetWithDecimal$(targetAsset)
  }, [assetWithDecimal$, targetAsset])

  const targetAssetRD: AssetWithDecimalRD = useObservableState(targetAssetDecimal$, RD.initial)

  const [balancesState] = useObservableState(
    () =>
      balancesState$({
        [ThorChain]: 'all'
      }),
    INITIAL_BALANCES_STATE
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

  useEffect(() => {
    // Source asset is the asset of the pool we need to interact with
    // Store it in global state, all depending streams will be updated then
    setSelectedPoolAsset(O.some(sourceAsset))
    // Reset selectedPoolAsset on view's unmount to avoid effects with depending streams
    return () => {
      setSelectedPoolAsset(O.none)
    }
  }, [sourceAsset, setSelectedPoolAsset])

  const keystore = useObservableState(keystoreState$, O.none)

  const poolsStateRD = useObservableState(poolsState$, RD.initial)
  const pendingPoolsStateRD = useObservableState(pendingPoolsState$, RD.initial)
  const importWalletHandler = useCallback(() => {
    navigate(walletRoutes.base.path(location.pathname))
  }, [location.pathname, navigate])

  const reloadHandler = useCallback(() => {
    reloadBalancesByChain(THORChain, sourceWalletType)
    reloadPools()
    reloadSelectedPoolDetail()
  }, [reloadBalancesByChain, reloadPools, reloadSelectedPoolDetail, sourceWalletType])

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
    FP.pipe(
      sourceWalletType === WalletType.Keystore ? oSourceKeystoreAddress : oSourceLedgerAddress,
      O.fold(
        () => setTradeAccountBalanceRD(RD.initial),
        (sourceAddress) => {
          setTradeAccountBalanceRD(RD.pending)
          getTradeAccount$(sourceAddress, sourceWalletType).subscribe((result) => {
            setTradeAccountBalanceRD(result)
          })
        }
      )
    )
  }, [getTradeAccount$, oSourceKeystoreAddress, oSourceLedgerAddress, sourceWalletType])

  const { validateSwapAddress } = useValidateAddress(targetChain)
  return (
    <>
      <div className="relative mb-4 flex items-center justify-between">
        <BackLinkButton className="absolute !m-0" />
        <h2 className="m-0 w-full text-center font-mainSemiBold text-16 uppercase text-turquoise">
          {intl.formatMessage({ id: 'common.swap' })}
        </h2>
        <RefreshButton className="absolute right-0" onClick={reloadHandler} />
      </div>

      <div className="flex justify-center bg-bg0 dark:bg-bg0d">
        {FP.pipe(
          sequenceTRD(poolsStateRD, sourceAssetRD, targetAssetRD, pendingPoolsStateRD),
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
                  poolAddress={selectedPoolAddress}
                  poolAssets={[]}
                  poolsData={{}}
                  pricePool={pricePool}
                  poolDetails={[]}
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
                  reloadTxStatus={reloadSwapTxStatus}
                  slipTolerance={tradeSlipTolerance}
                  changeSlipTolerance={changeTradeSlipTolerance}
                  tradeAccountBalances={tradeAccountBalanceRD}
                />
              )
            },
            renderError,
            ([{ assetDetails, poolsData, poolDetails }, sourceAsset, targetAsset, pendingPools]) => {
              const combinedAssetDetails = [...assetDetails, ...pendingPools.assetDetails]

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
                  poolAddress={selectedPoolAddress}
                  poolAssets={poolAssets}
                  poolsData={poolsData}
                  pricePool={pricePool}
                  poolDetails={poolDetails}
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
                  reloadTxStatus={reloadSwapTxStatus}
                  slipTolerance={tradeSlipTolerance}
                  changeSlipTolerance={changeTradeSlipTolerance}
                  tradeAccountBalances={tradeAccountBalanceRD}
                />
              )
            }
          )
        )}
      </div>
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
