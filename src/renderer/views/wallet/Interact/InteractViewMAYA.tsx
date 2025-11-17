import { useCallback, useMemo, useEffect, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate, useParams } from 'react-router-dom'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ErrorView } from '../../../components/shared/error'
import { BackLinkButton, RefreshButton } from '../../../components/uielements/button'
import { Spin } from '../../../components/uielements/spin'
import { Interact } from '../../../components/wallet/txs/interact'
import { getInteractTypeFromNullableString } from '../../../components/wallet/txs/interact/Interact.helpers'
import { InteractType } from '../../../components/wallet/txs/interact/Interact.types'
import { InteractFormMaya } from '../../../components/wallet/txs/interact/InteractFormMaya'
import { DEFAULT_WALLET_TYPE } from '../../../const'
import { useMayachainContext } from '../../../contexts/MayachainContext'
import { useMayachainQueryContext } from '../../../contexts/MayachainQueryContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { eqOSelectedWalletAsset } from '../../../helpers/fp/eq'
import { sequenceTOption, sequenceTRD } from '../../../helpers/fpHelpers'
import { liveData } from '../../../helpers/rx/liveData'
import { getWalletBalanceByAddressAndAsset } from '../../../helpers/walletHelper'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { usePoolShares } from '../../../hooks/usePoolShares'
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import * as walletRoutes from '../../../routes/wallet'
import { FeeRD } from '../../../services/chain/types'
import { getNodeInfos$ } from '../../../services/mayachain'
import { CacaoPoolProviderRD, NodeInfosRD } from '../../../services/mayachain/types'
import { userNodes$ } from '../../../services/storage/userNodes'
import { reloadBalancesByChain } from '../../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { SelectedWalletAssetRD } from '../../../services/wallet/types'

export const InteractViewMAYA = () => {
  const { interactType: routeInteractType } = useParams<walletRoutes.InteractParams>()
  const intl = useIntl()
  const { selectedAsset$ } = useWalletContext()

  const { allSharesRD: allMayaSharesRD } = usePoolShares(MAYAChain)

  const [selectedAssetRD] = useObservableState<SelectedWalletAssetRD>(
    () =>
      FP.pipe(
        selectedAsset$,
        RxOp.distinctUntilChanged(eqOSelectedWalletAsset.equals),
        RxOp.map((v) => v),
        RxOp.map((oSelectedAsset) => RD.fromOption(oSelectedAsset, () => Error('No selected asset'))),
        RxOp.startWith(RD.pending)
      ),
    RD.initial
  )

  const oSelectedAsset = useObservableState(selectedAsset$, O.none)

  const assetChain = useMemo(
    () =>
      FP.pipe(
        oSelectedAsset,
        O.map((selectedAsset) => selectedAsset.asset.chain),
        O.getOrElse(() => '') // Replace "defaultChain" with an appropriate default value
      ),
    [oSelectedAsset]
  )

  const interactTypeRD = FP.pipe(routeInteractType, getInteractTypeFromNullableString, (oInteractType) =>
    RD.fromOption(oInteractType, () => Error(`Invalid route param for interactive type: ${routeInteractType}`))
  )

  const navigate = useNavigate()

  const { network } = useNetwork()
  const {
    balancesState$,
    keystoreService: { validatePassword$ }
  } = useWalletContext()

  const [{ balances: oBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )
  const {
    service: {
      pools: { poolsState$ }
    }
  } = useMidgardMayaContext()
  const poolsRD = useObservableState(poolsState$, RD.pending)
  const poolDetails = RD.toNullable(poolsRD)?.poolDetails ?? []

  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(assetChain))

  const { validateAddress } = useValidateAddress(assetChain)

  const { mayachainQuery } = useMayachainQueryContext()

  const oWalletBalance = useMemo(() => {
    return FP.pipe(
      selectedAssetRD,
      RD.toOption, // Convert RemoteData to Option
      O.chain((selectedAsset) => {
        // Combine oBalances and oSelectedAsset into a single Option
        return FP.pipe(
          sequenceTOption(oBalances, O.some(selectedAsset)),
          // Extract balance for the given walletAddress and asset
          O.chain(([balances, { walletAddress }]) =>
            getWalletBalanceByAddressAndAsset({ balances, address: walletAddress, asset: selectedAsset.asset })
          )
        )
      })
    )
  }, [oBalances, selectedAssetRD])

  const {
    fees$,
    reloadFees,
    interactMaya$,
    getCacaoPoolProvider$,
    reloadCacaoPoolProvider,
    mayachainLastblockState$,
    mimir$
  } = useMayachainContext()

  const [feeRD] = useObservableState<FeeRD>(
    () =>
      FP.pipe(
        fees$(),
        liveData.map((fees) => fees.fast)
      ),
    RD.initial
  )

  const [nodeInfos] = useObservableState<NodeInfosRD>(
    () =>
      FP.pipe(
        Rx.combineLatest([userNodes$, getNodeInfos$]),
        RxOp.switchMap(([userNodes, nodeInfos]) =>
          Rx.of(
            FP.pipe(
              nodeInfos,
              RD.map((data) =>
                FP.pipe(
                  data,
                  A.filter(({ address }) => userNodes.includes(address))
                )
              )
            )
          )
        )
      ),
    RD.initial
  )

  const mayachainLastblockRD = useObservableState(mayachainLastblockState$, RD.initial)
  const mimirRD = useObservableState(mimir$, RD.initial)

  const [cacaoPoolProviderRD, setCacaoPoolProviderRD] = useState<CacaoPoolProviderRD>(RD.initial)

  useEffect(() => {
    if (O.isSome(oWalletBalance)) {
      setCacaoPoolProviderRD(RD.pending) // Set to pending while fetching data

      const subscription = getCacaoPoolProvider$(
        oWalletBalance.value.walletAddress,
        oWalletBalance.value.walletType
      ).subscribe({
        next: (rdProvider) => {
          FP.pipe(
            rdProvider,
            RD.fold(
              () => setCacaoPoolProviderRD(RD.initial),
              () => setCacaoPoolProviderRD(RD.pending),
              (error) => setCacaoPoolProviderRD(RD.failure(error)),
              (provider) => setCacaoPoolProviderRD(RD.success(provider))
            )
          )
        },
        error: (error) => {
          setCacaoPoolProviderRD(RD.failure(error))
        }
      })

      return () => {
        subscription.unsubscribe()
      } // Cleanup on unmount or when dependencies change
    } else {
      setCacaoPoolProviderRD(RD.initial) // Set to initial if no wallet balance
    }
  }, [oWalletBalance, getCacaoPoolProvider$])

  const interactTypeChanged = useCallback(
    (type: InteractType) => {
      navigate(
        walletRoutes.interact.path({
          interactType: type
        })
      )
    },
    [navigate]
  )
  const reloadHandler = useCallback(() => {
    const lazyReload = reloadBalancesByChain(assetChain, DEFAULT_WALLET_TYPE)
    reloadCacaoPoolProvider()
    lazyReload() // Invoke the lazy function
  }, [assetChain, reloadCacaoPoolProvider])

  return FP.pipe(
    sequenceTRD(interactTypeRD, selectedAssetRD),
    RD.fold(
      () => <Spin />,
      () => <Spin />,
      (error) => (
        <div>
          <BackLinkButton />
          <ErrorView
            title={intl.formatMessage({ id: 'error.interact.missingData.title' })}
            subTitle={error?.message ?? error.toString()}
          />
        </div>
      ),
      ([interactType, { walletType, walletAccount, walletIndex, hdMode }]) => (
        <>
          <div className="relative mb-4 flex items-center justify-between">
            <div className="flex items-start justify-between">
              <BackLinkButton />
              <RefreshButton className="absolute right-0" onClick={reloadHandler} />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center overflow-auto bg-bg0 dark:bg-bg0d">
            {FP.pipe(
              oWalletBalance,
              O.fold(
                () => <Spin />,
                (walletBalance) => (
                  <Interact
                    interactType={interactType}
                    interactTypeChanged={interactTypeChanged}
                    network={network}
                    walletType={walletType}
                    chain={assetChain}>
                    <InteractFormMaya
                      interactType={interactType}
                      walletAccount={walletAccount}
                      walletIndex={walletIndex}
                      walletType={walletType}
                      hdMode={hdMode}
                      balance={walletBalance}
                      interactMaya$={interactMaya$}
                      openExplorerTxUrl={openExplorerTxUrl}
                      getExplorerTxUrl={getExplorerTxUrl}
                      addressValidation={validateAddress}
                      fee={feeRD}
                      reloadFeesHandler={reloadFees}
                      validatePassword$={validatePassword$}
                      mayachainQuery={mayachainQuery}
                      network={network}
                      poolDetails={poolDetails}
                      nodes={nodeInfos}
                      poolShares={allMayaSharesRD}
                      cacaoPoolProvider={cacaoPoolProviderRD}
                      mayachainLastblockRD={mayachainLastblockRD}
                      mimirRD={mimirRD}
                    />
                  </Interact>
                )
              )
            )}
          </div>
        </>
      )
    )
  )
}
