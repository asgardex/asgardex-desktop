import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Col, Row } from 'antd'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ErrorView } from '../../../components/shared/error'
import { LoadingView } from '../../../components/shared/loading'
import { BackLinkButton, RefreshButton } from '../../../components/uielements/button'
import { Interact } from '../../../components/wallet/txs/interact'
import { getInteractTypeFromNullableString } from '../../../components/wallet/txs/interact/Interact.helpers'
import { InteractType } from '../../../components/wallet/txs/interact/Interact.types'
import { InteractFormThor } from '../../../components/wallet/txs/interact/InteractFormThor'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useThorchainQueryContext } from '../../../contexts/ThorchainQueryContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { eqOSelectedWalletAsset } from '../../../helpers/fp/eq'
import { sequenceTOption, sequenceTRD } from '../../../helpers/fpHelpers'
import { liveData } from '../../../helpers/rx/liveData'
import { getWalletBalanceByAddressAndAsset } from '../../../helpers/walletHelper'
import { useNetwork } from '../../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import * as walletRoutes from '../../../routes/wallet'
import { FeeRD } from '../../../services/chain/types'
import { userNodes$ } from '../../../services/storage/userNodes'
import { NodeInfosRD, RunePoolProviderRD, ThorchainLastblockRD } from '../../../services/thorchain/types'
import { reloadBalancesByChain } from '../../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { SelectedWalletAssetRD } from '../../../services/wallet/types'
import * as Styled from './InteractView.styles'

export const InteractViewTHOR: React.FC = () => {
  const { interactType: routeInteractType } = useParams<walletRoutes.BondParams>()

  const { selectedAsset$ } = useWalletContext()
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
  } = useMidgardContext()
  const poolsRD = useObservableState(poolsState$, RD.pending)
  const poolDetails = RD.toNullable(poolsRD)?.poolDetails ?? []

  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(assetChain))

  const { validateAddress } = useValidateAddress(assetChain)
  const { thorchainQuery } = useThorchainQueryContext()

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
    interact$,
    getNodeInfos$,
    getRunePoolProvider$,
    reloadRunePoolProvider,
    thorchainLastblockState$
  } = useThorchainContext()

  const [feeRD] = useObservableState<FeeRD>(
    () =>
      FP.pipe(
        fees$(),
        liveData.map((fees) => fees.fast)
      ),
    RD.initial
  )

  const thorchainLastblockRD: ThorchainLastblockRD = useObservableState(thorchainLastblockState$, RD.pending)

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

  const [runePoolProviderRD, setRunePoolProviderRD] = useState<RunePoolProviderRD>(RD.initial)

  useEffect(() => {
    if (O.isSome(oWalletBalance)) {
      setRunePoolProviderRD(RD.pending) // Set to pending while fetching data

      const subscription = getRunePoolProvider$(
        oWalletBalance.value.walletAddress,
        oWalletBalance.value.walletType
      ).subscribe({
        next: (rdProvider) => {
          FP.pipe(
            rdProvider,
            RD.fold(
              () => setRunePoolProviderRD(RD.initial),
              () => setRunePoolProviderRD(RD.pending),
              (error) => setRunePoolProviderRD(RD.failure(error)),
              (provider) => setRunePoolProviderRD(RD.success(provider))
            )
          )
        },
        error: (error) => setRunePoolProviderRD(RD.failure(error))
      })

      return () => subscription.unsubscribe() // Cleanup on unmount or when dependencies change
    } else {
      setRunePoolProviderRD(RD.initial) // Set to initial if no wallet balance
    }
  }, [oWalletBalance, getRunePoolProvider$])
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
    const lazyReload = reloadBalancesByChain(assetChain)
    reloadRunePoolProvider()
    lazyReload() // Invoke the lazy function
  }, [assetChain, reloadRunePoolProvider])

  return FP.pipe(
    sequenceTRD(interactTypeRD, selectedAssetRD),
    RD.fold(
      () => <LoadingView size="large" />,
      () => <LoadingView size="large" />,
      (error) => (
        <div>
          <BackLinkButton />
          <ErrorView title="Missing data for InteractiveView" subTitle={error?.message ?? error.toString()} />
        </div>
      ),
      ([interactType, { walletType, walletAccount, walletIndex, hdMode }]) => (
        <>
          <div className="relative mb-20px flex items-center justify-between">
            <Row justify="space-between">
              <Col>
                <BackLinkButton />
              </Col>
              <RefreshButton className="absolute right-0" onClick={reloadHandler} />
            </Row>
          </div>

          <Styled.Container>
            {FP.pipe(
              oWalletBalance,
              O.fold(
                () => <LoadingView size="large" />,
                (walletBalance) => (
                  <Interact
                    interactType={interactType}
                    interactTypeChanged={interactTypeChanged}
                    network={network}
                    walletType={walletType}
                    chain={assetChain}>
                    <InteractFormThor
                      interactType={interactType}
                      walletAccount={walletAccount}
                      walletIndex={walletIndex}
                      walletType={walletType}
                      hdMode={hdMode}
                      balance={walletBalance}
                      interact$={interact$}
                      openExplorerTxUrl={openExplorerTxUrl}
                      getExplorerTxUrl={getExplorerTxUrl}
                      addressValidation={validateAddress}
                      fee={feeRD}
                      reloadFeesHandler={reloadFees}
                      validatePassword$={validatePassword$}
                      thorchainQuery={thorchainQuery}
                      network={network}
                      poolDetails={poolDetails}
                      nodes={nodeInfos}
                      runePoolProvider={runePoolProviderRD}
                      thorchainLastblock={thorchainLastblockRD}
                    />
                  </Interact>
                )
              )
            )}
          </Styled.Container>
        </>
      )
    )
  )
}
