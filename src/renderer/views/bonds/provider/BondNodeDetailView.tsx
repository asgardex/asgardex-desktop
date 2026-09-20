import { useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import {
  BondActionModal,
  BondActionType,
  BondProvidersList,
  BondSplit,
  NodeApyCard,
  NodeEarningsCard,
  NoThorAddressCard,
  addressExplorerUrl,
  formatApy,
  formatOperatorFee,
  formatRuneAmount,
  isUnbondLocked,
  nodeExplorerUrl
} from '../../../components/Bonds/provider'
import { NodeStatusTag } from '../../../components/Bonds/provider/NodeStatusTag'
import { ErrorView } from '../../../components/shared/error'
import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { BaseButton, FlatButton } from '../../../components/uielements/button'
import { WalletTypeLabel } from '../../../components/uielements/common'
import { CopyLabel } from '../../../components/uielements/label'
import { Spin } from '../../../components/uielements/spin'
import { Tooltip } from '../../../components/uielements/tooltip'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { truncateAddress } from '../../../helpers/addressHelper'
import { liveData } from '../../../helpers/rx/liveData'
import { hiddenString } from '../../../helpers/stringHelper'
import { useMimirConstants } from '../../../hooks/useMimirConstants'
import { useNextChurn } from '../../../hooks/useNextChurn'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useNodeHistory } from '../../../hooks/useRunebondRewards'
import * as bondsRoutes from '../../../routes/bonds'
import { FeeRD } from '../../../services/chain/types'
import { NodeInfo } from '../../../services/thorchain/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { useApp } from '../../../store/app/hooks'
import { BondProviderPosition } from '../types'
import { useBondProviderData } from './useBondProviderData'

const MIMIR_KEYS = ['MAXBONDPROVIDERS']

type NodeDetail = {
  node: NodeInfo
}

export const BondNodeDetailView = (): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const { state } = useLocation()
  const { nodeAddress } = useParams<bondsRoutes.NodeDetailParams>()
  const { isPrivate } = useApp()

  const backTab = bondsRoutes.isBondsTab(state?.tab) ? state.tab : bondsRoutes.BondsTab.BondProvider
  const isOperatorView = backTab === bondsRoutes.BondsTab.NodeOperator
  const signerAddress: string | undefined = typeof state?.signer === 'string' ? state.signer : undefined

  const {
    network,
    walletInfos,
    hasMultipleWalletTypes,
    balanceByAddress,
    positionsRD,
    bondingApy,
    noThorAddress,
    reload
  } = useBondProviderData()

  const providerAddresses = useMemo(() => walletInfos.map(({ address }) => address), [walletInfos])
  const walletTypeByAddress = useMemo(
    () => new Map(walletInfos.map(({ address, walletType }) => [address.toLowerCase(), walletType])),
    [walletInfos]
  )

  const oViewedPosition: O.Option<BondProviderPosition> = useMemo(
    () =>
      FP.pipe(
        positionsRD,
        RD.toOption,
        O.chain((positions) => {
          const onThisNode = positions.filter((position) => position.nodeAddress === nodeAddress)
          return O.fromNullable(
            onThisNode.find(({ signer }) => signer.address.toLowerCase() === signerAddress?.toLowerCase()) ??
              onThisNode[0]
          )
        })
      ),
    [nodeAddress, positionsRD, signerAddress]
  )

  const historyAddresses = useMemo(
    () =>
      FP.pipe(
        oViewedPosition,
        O.fold(
          () => [],
          ({ signer }) => [signer.address]
        )
      ),
    [oViewedPosition]
  )
  const nodeHistoryRD = useNodeHistory(
    isOperatorView || O.isNone(oViewedPosition) ? undefined : nodeAddress,
    historyAddresses
  )

  const { interact$, fees$, getNodeInfos$ } = useThorchainContext()
  const {
    keystoreService: { validatePassword$ }
  } = useWalletContext()
  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(THORChain))
  const nextChurn = useNextChurn()
  const { MAXBONDPROVIDERS: maxBondProviders } = useMimirConstants(MIMIR_KEYS)

  const nodeInfosRD = useObservableState(getNodeInfos$, RD.initial)

  const [feeRD] = useObservableState<FeeRD>(
    () =>
      FP.pipe(
        fees$(),
        liveData.map((fees) => fees.fast)
      ),
    RD.initial
  )

  const [modalType, setModalType] = useState<BondActionType | null>(null)
  const [hoveredChurn, setHoveredChurn] = useState<number | null>(null)

  const goBack = useCallback(() => navigate(bondsRoutes.basePathWithTab(backTab)), [backTab, navigate])

  const detailRD: RD.RemoteData<Error, O.Option<NodeDetail>> = useMemo(
    () =>
      FP.pipe(
        RD.combine(nodeInfosRD, positionsRD),
        RD.map(([nodes]) =>
          FP.pipe(
            O.fromNullable(nodes.find((node) => node.address === nodeAddress)),
            O.map((node) => ({ node }))
          )
        )
      ),
    [nodeAddress, nodeInfosRD, positionsRD]
  )

  const closeModal = useCallback(() => setModalType(null), [])
  const finishModal = useCallback(() => {
    setModalType(null)
    reload()
  }, [reload])

  const nodeApyLabel: O.Option<string> = useMemo(
    () =>
      FP.pipe(
        nodeHistoryRD,
        RD.toOption,
        O.chain(({ apySeries }) => O.fromNullable(apySeries[apySeries.length - 1])),
        O.map(({ apy }) => apy),
        O.alt(() => bondingApy),
        O.map(formatApy)
      ),
    [bondingApy, nodeHistoryRD]
  )

  const renderDetail = ({ node }: NodeDetail) => {
    const unbondLocked = isUnbondLocked(node.status, node.signMembership)

    const myAddresses = new Set(providerAddresses.map((address) => address.toLowerCase()))
    const isMine = (address: string) => myAddresses.has(address.toLowerCase())

    const myBond = FP.pipe(
      oViewedPosition,
      O.map(({ myBond }) => myBond),
      O.getOrElse(() => ZERO_BASE_AMOUNT)
    )

    const percentOf = (amount: BaseAmount, decimals = 0) =>
      node.bond.gt(0)
        ? `${baseToAsset(amount).amount().div(baseToAsset(node.bond).amount()).times(100).toFixed(decimals)}%`
        : '0%'

    const providers = [...node.bondProviders.providers].sort((a, b) => (b.bond.gt(a.bond) ? 1 : -1))

    const slotsLabel =
      Number.isFinite(maxBondProviders) && maxBondProviders > 0
        ? intl.formatMessage({ id: 'bonds.provider.detail.slots' }, { count: providers.length, max: maxBondProviders })
        : intl.formatMessage({ id: 'bonds.provider.detail.providersCount' }, { count: providers.length })

    const providerName = (address: string) => {
      if (!isMine(address)) return truncateAddress(address, THORChain, network)
      const you = intl.formatMessage({ id: 'bonds.provider.detail.you' })
      const walletType = walletTypeByAddress.get(address.toLowerCase())
      return hasMultipleWalletTypes && walletType ? `${you} (${walletTypeToI18n(walletType, intl)})` : you
    }

    const renderExplorerLink = (url: string) => (
      <BaseButton
        className="!p-0 text-gray2 hover:text-turquoise dark:text-gray2d"
        title={intl.formatMessage({ id: 'bonds.provider.detail.viewOnExplorer' })}
        onClick={() => window.apiUrl.openExternal(url)}>
        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-inherit" />
      </BaseButton>
    )

    return (
      <div className="flex w-full flex-col">
        <div className="flex w-full flex-col gap-6 rounded-lg border border-solid border-gray0 bg-bg0 p-6 lg:flex-row lg:items-start lg:justify-between dark:border-gray0d dark:bg-bg0d">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="font-main text-[16px] text-text0 dark:text-text0d">
                {truncateAddress(node.address, THORChain, network)}
              </span>
              <CopyLabel textToCopy={node.address} iconClassName="!h-4 !w-4" />
              {renderExplorerLink(nodeExplorerUrl(node.address))}
              <NodeStatusTag status={node.status} />
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-main text-[13px] text-gray2 dark:text-gray2d">
              <span>{intl.formatMessage({ id: 'bonds.provider.detail.operator' })}</span>
              <span>{truncateAddress(node.nodeOperatorAddress, THORChain, network)}</span>
              {renderExplorerLink(addressExplorerUrl(node.nodeOperatorAddress))}
              {isMine(node.nodeOperatorAddress) && (
                <>
                  <span>{` · ${intl.formatMessage({ id: 'bonds.provider.detail.youOperate' })}`}</span>
                  {hasMultipleWalletTypes &&
                    FP.pipe(
                      O.fromNullable(walletTypeByAddress.get(node.nodeOperatorAddress.toLowerCase())),
                      O.fold(
                        () => null,
                        (walletType) => (
                          <WalletTypeLabel className="text-[9px] leading-3">
                            {walletTypeToI18n(walletType, intl)}
                          </WalletTypeLabel>
                        )
                      )
                    )}
                </>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <AssetIcon asset={AssetRuneNative} size="normal" network={network} />
              <span className="font-main-bold text-[44px] leading-none text-text0 dark:text-text0d">
                {isPrivate ? hiddenString : formatRuneAmount(isOperatorView ? node.bond : myBond)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 font-main text-[14px] text-gray2 dark:text-gray2d">
              {isOperatorView
                ? `${slotsLabel} · ${intl.formatMessage(
                    { id: 'bonds.operator.detail.fee' },
                    { fee: formatOperatorFee(node.bondProviders.nodeOperatorFee, intl.locale) }
                  )}`
                : intl.formatMessage({ id: 'bonds.provider.detail.share' }, { percent: percentOf(myBond) })}
              {!isOperatorView &&
                hasMultipleWalletTypes &&
                FP.pipe(
                  oViewedPosition,
                  O.fold(
                    () => null,
                    ({ signer }) => (
                      <WalletTypeLabel className="text-[9px] leading-3">
                        {walletTypeToI18n(signer.walletType, intl)}
                      </WalletTypeLabel>
                    )
                  )
                )}
            </div>
          </div>
          {!isOperatorView && O.isSome(oViewedPosition) && (
            <div className="flex items-center justify-end gap-3 self-center">
              {unbondLocked ? (
                <Tooltip title={intl.formatMessage({ id: 'bonds.provider.detail.unbondLocked' })}>
                  <FlatButton size="large" color="neutral" disabled>
                    {intl.formatMessage({ id: 'bonds.provider.unbond' })}
                  </FlatButton>
                </Tooltip>
              ) : (
                <FlatButton size="large" color="neutral" onClick={() => setModalType('unbond')}>
                  {intl.formatMessage({ id: 'bonds.provider.unbond' })}
                </FlatButton>
              )}
              <FlatButton size="large" onClick={() => setModalType('bond')}>
                {intl.formatMessage({ id: 'bonds.provider.bondMore' })}
              </FlatButton>
            </div>
          )}
        </div>

        {isOperatorView ? (
          <div className="mt-6 grid w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <BondProvidersList
              network={network}
              isPrivate={isPrivate}
              providers={providers}
              nodeBond={node.bond}
              slotsLabel={slotsLabel}
              isMine={isMine}
            />
            <BondSplit
              network={network}
              isPrivate={isPrivate}
              providers={providers}
              nodeBond={node.bond}
              providerName={providerName}
              layout="card"
            />
          </div>
        ) : (
          <>
            <div className="mt-6 grid w-full grid-cols-1 gap-6 xl:grid-cols-2">
              <NodeApyCard historyRD={nodeHistoryRD} apyLabel={nodeApyLabel} />
              <NodeEarningsCard
                historyRD={nodeHistoryRD}
                isPrivate={isPrivate}
                activeIndex={hoveredChurn}
                onActiveIndexChange={setHoveredChurn}
              />
            </div>
            <BondSplit
              network={network}
              isPrivate={isPrivate}
              providers={providers}
              nodeBond={node.bond}
              providerName={providerName}
              layout="row"
            />
          </>
        )}

        {modalType &&
          FP.pipe(
            oViewedPosition,
            O.fold(
              () => null,
              (position) => (
                <BondActionModal
                  type={modalType}
                  network={network}
                  position={position}
                  walletBalance={balanceByAddress(position.signer.address)}
                  nextChurn={nextChurn}
                  fee={feeRD}
                  interact$={interact$}
                  validatePassword$={validatePassword$}
                  openExplorerTxUrl={openExplorerTxUrl}
                  getExplorerTxUrl={getExplorerTxUrl}
                  onClose={closeModal}
                  onFinish={finishModal}
                />
              )
            )
          )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start">
      <BaseButton className="group !p-0 font-main-semi-bold text-[14px] text-turquoise uppercase" onClick={goBack}>
        <ArrowLeftIcon className="mr-1 h-[16px] w-[16px] text-inherit transition-transform group-hover:-translate-x-[2px]" />
        {intl.formatMessage({ id: isOperatorView ? 'bonds.operator.detail.back' : 'bonds.provider.detail.back' })}
      </BaseButton>
      <div className="mt-8 w-full">
        {noThorAddress ? (
          <NoThorAddressCard onReload={reload} />
        ) : (
          FP.pipe(
            detailRD,
            RD.fold(
              () => <Spin className="m-auto" />,
              () => <Spin className="m-auto" />,
              (error) => (
                <ErrorView
                  title={intl.formatMessage({ id: 'bonds.nodes.error' })}
                  subTitle={error?.message ?? error.toString()}
                />
              ),
              (oDetail) =>
                FP.pipe(
                  oDetail,
                  O.fold(
                    () => (
                      <ErrorView title={intl.formatMessage({ id: 'bonds.nodes.error' })} subTitle={nodeAddress ?? ''} />
                    ),
                    renderDetail
                  )
                )
            )
          )
        )}
      </div>
    </div>
  )
}
