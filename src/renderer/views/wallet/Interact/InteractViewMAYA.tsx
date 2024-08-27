import React, { useCallback, useMemo } from 'react'

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
import { InteractFormMaya } from '../../../components/wallet/txs/interact/InteractFormMaya'
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
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import * as walletRoutes from '../../../routes/wallet'
import { FeeRD } from '../../../services/chain/types'
import { getNodeInfos$ } from '../../../services/mayachain'
import { NodeInfosRD } from '../../../services/mayachain/types'
import { userNodes$ } from '../../../services/storage/userNodes'
import { reloadBalancesByChain } from '../../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { SelectedWalletAssetRD } from '../../../services/wallet/types'
import * as Styled from './InteractView.styles'

export const InteractViewMAYA: React.FC = () => {
  const { interactType: routeInteractType } = useParams<walletRoutes.InteractParams>()

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

  const { fees$, reloadFees, interactMaya$ } = useMayachainContext()

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
    lazyReload() // Invoke the lazy function
  }, [assetChain])

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
            {' '}
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
