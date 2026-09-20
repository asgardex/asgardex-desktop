import { useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import {
  BondActionModal,
  BondActionType,
  BondNodeCard,
  BondProviderStats,
  HowBondingWorks,
  NoThorAddressCard,
  formatRuneAmount
} from '../../../components/Bonds/provider'
import { ErrorView } from '../../../components/shared/error'
import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { FlatButton, RefreshButton } from '../../../components/uielements/button'
import { Spin } from '../../../components/uielements/spin'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { liveData } from '../../../helpers/rx/liveData'
import { hiddenString } from '../../../helpers/stringHelper'
import { useNextChurn } from '../../../hooks/useNextChurn'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useNodeProviderRewards, useProviderRewards } from '../../../hooks/useRunebondRewards'
import * as bondsRoutes from '../../../routes/bonds'
import { FeeRD } from '../../../services/chain/types'
import { RUNEBOND_URL } from '../../../services/runebond'
import { useApp } from '../../../store/app/hooks'
import { BondProviderPosition } from '../types'
import { useBondProviderData } from './useBondProviderData'

type ModalState = { type: BondActionType; position: BondProviderPosition } | null

export const BondProviderDashboardView = (): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const { isPrivate } = useApp()

  const {
    network,
    walletInfos,
    hasMultipleWalletTypes,
    freeToBond,
    balanceByAddress,
    positionsRD,
    bondingApy,
    noThorAddress,
    formatPrice,
    reload
  } = useBondProviderData()

  const { interact$, fees$ } = useThorchainContext()
  const {
    keystoreService: { validatePassword$ }
  } = useWalletContext()
  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(THORChain))
  const nextChurn = useNextChurn()

  const [feeRD] = useObservableState<FeeRD>(
    () =>
      FP.pipe(
        fees$(),
        liveData.map((fees) => fees.fast)
      ),
    RD.initial
  )

  const providerAddresses = useMemo(() => walletInfos.map(({ address }) => address), [walletInfos])

  const providerRewardsRD = useProviderRewards(providerAddresses)
  const nodeRewardsRD = useNodeProviderRewards(providerAddresses)

  const paidLastChurnRD: RD.RemoteData<Error, BaseAmount> = useMemo(
    () =>
      FP.pipe(
        providerRewardsRD,
        RD.chain((rewards) =>
          FP.pipe(
            rewards.lastChurnTotal,
            O.fold(
              () => RD.failure<Error, BaseAmount>(Error('no payouts yet')),
              (amount) => RD.success<Error, BaseAmount>(amount)
            )
          )
        )
      ),
    [providerRewardsRD]
  )

  const lastPayoutByNode = useCallback(
    (nodeAddress: string): RD.RemoteData<Error, O.Option<BaseAmount>> =>
      FP.pipe(
        nodeRewardsRD,
        RD.map((nodes) =>
          FP.pipe(
            O.fromNullable(nodes.find((node) => node.nodeAddress === nodeAddress)),
            O.chain(({ lastPayout }) => lastPayout)
          )
        )
      ),
    [nodeRewardsRD]
  )

  const [modal, setModal] = useState<ModalState>(null)

  const closeModal = useCallback(() => setModal(null), [])
  const finishModal = useCallback(() => {
    setModal(null)
    reload()
  }, [reload])

  const openDetail = useCallback(
    ({ nodeAddress, signer }: BondProviderPosition) =>
      navigate(bondsRoutes.node.path({ nodeAddress }), { state: { signer: signer.address } }),
    [navigate]
  )

  const goToRewards = useCallback(() => navigate(bondsRoutes.rewards.path()), [navigate])

  const openRunebond = useCallback(() => window.apiUrl.openExternal(RUNEBOND_URL), [])

  const renderEmpty = (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-col gap-6 rounded-lg border border-solid border-gray0 bg-bg0 p-6 lg:flex-row lg:items-start lg:justify-between dark:border-gray0d dark:bg-bg0d">
        <div className="flex flex-col">
          <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
            {intl.formatMessage({ id: 'bonds.provider.yourBond' })}
          </span>
          <div className="mt-2 flex items-center gap-3">
            <AssetIcon asset={AssetRuneNative} size="normal" network={network} />
            <span className="font-main-bold text-[44px] leading-none text-text0 dark:text-text0d">0</span>
          </div>
          <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">
            {intl.formatMessage(
              { id: 'bonds.provider.empty.noWhitelist' },
              { amount: isPrivate ? hiddenString : formatRuneAmount(freeToBond) }
            )}
          </span>
        </div>
        <div className="flex flex-col items-start gap-4 lg:items-end lg:justify-between lg:self-stretch">
          <FlatButton size="large" onClick={openRunebond}>
            {intl.formatMessage({ id: 'bonds.provider.empty.findNode' })}
            <ArrowTopRightOnSquareIcon className="ml-2 h-[16px] w-[16px] text-inherit" />
          </FlatButton>
          <RefreshButton onClick={reload} disabled={RD.isPending(positionsRD)} />
        </div>
      </div>
      <div className="mt-6 w-full">
        <HowBondingWorks />
      </div>
    </div>
  )

  const renderPositions = (positions: BondProviderPosition[]) => {
    if (positions.length === 0) return renderEmpty

    const totalBond = positions.reduce((acc, { myBond }) => acc.plus(myBond), ZERO_BASE_AMOUNT)

    return (
      <div className="flex w-full flex-col">
        <BondProviderStats
          network={network}
          isPrivate={isPrivate}
          totalBond={totalBond}
          totalBondPrice={formatPrice(totalBond)}
          freeToBond={freeToBond}
          paidLastChurn={paidLastChurnRD}
          onHistoryClick={goToRewards}
          onReload={reload}
          reloading={RD.isPending(positionsRD)}
        />
        <div className="mt-6 grid w-full grid-cols-1 gap-6 xl:grid-cols-2">
          {positions.map((position) => (
            <BondNodeCard
              key={`${position.nodeAddress}-${position.signer.address}`}
              network={network}
              isPrivate={isPrivate}
              position={position}
              showWalletType={hasMultipleWalletTypes}
              lastPayout={lastPayoutByNode(position.nodeAddress)}
              onBondMore={(p) => setModal({ type: 'bond', position: p })}
              onUnbond={(p) => setModal({ type: 'unbond', position: p })}
              onOpenDetail={openDetail}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col">
      <div className="w-full">
        {noThorAddress ? (
          <NoThorAddressCard onReload={reload} />
        ) : (
          FP.pipe(
            positionsRD,
            RD.fold(
              () => <Spin className="m-auto" />,
              () => <Spin className="m-auto" />,
              (error) => (
                <ErrorView
                  title={intl.formatMessage({ id: 'bonds.nodes.error' })}
                  subTitle={error?.message ?? error.toString()}
                  extra={<FlatButton onClick={reload}>{intl.formatMessage({ id: 'common.retry' })}</FlatButton>}
                />
              ),
              renderPositions
            )
          )
        )}
      </div>
      {modal && (
        <BondActionModal
          type={modal.type}
          network={network}
          position={modal.position}
          walletBalance={balanceByAddress(modal.position.signer.address)}
          bondingApy={bondingApy}
          nextChurn={nextChurn}
          fee={feeRD}
          interact$={interact$}
          validatePassword$={validatePassword$}
          openExplorerTxUrl={openExplorerTxUrl}
          getExplorerTxUrl={getExplorerTxUrl}
          onClose={closeModal}
          onFinish={finishModal}
        />
      )}
    </div>
  )
}
