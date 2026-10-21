import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowLeftIcon } from '@heroicons/react/20/solid'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { THORChain } from '../../../../shared/utils/chainIds'
import {
  NodeOperatorActionModal,
  RunebondRefreshButton,
  RunebondUnavailablePanel,
  formatRuneAmount
} from '../../../components/Bonds/provider'
import { RunebondRequestCard } from '../../../components/Bonds/provider/RunebondRequestCard'
import { useRunebondApprove } from '../../../components/Bonds/provider/useRunebondApprove'
import { ErrorView } from '../../../components/shared/error'
import { BaseButton } from '../../../components/uielements/button'
import { Spin } from '../../../components/uielements/spin'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useUserNodesContext } from '../../../contexts/UserNodesContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { truncateAddress } from '../../../helpers/addressHelper'
import { liveData } from '../../../helpers/rx/liveData'
import { hiddenString } from '../../../helpers/stringHelper'
import { useChurnConstants } from '../../../hooks/useChurnConstants'
import { useLastSuccessRD } from '../../../hooks/useLastSuccess'
import { useNextChurn } from '../../../hooks/useNextChurn'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { operatorAddressesOf } from '../../../hooks/useOperatorFees'
import { useOperatorNodes } from '../../../hooks/useOperatorNodes'
import { useOperatorWhitelistRequests } from '../../../hooks/useRunebondListing'
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import * as bondsRoutes from '../../../routes/bonds'
import { FeeRD } from '../../../services/chain/types'
import { OperatorWhitelistRequests, WhitelistRequest } from '../../../services/runebond'
import { NodeInfo } from '../../../services/thorchain/types'
import { useApp } from '../../../store/app/hooks'
import { BondWalletInfo } from '../types'
import { useBondProviderData } from './useBondProviderData'

const CARD = 'rounded-lg border border-solid border-gray0 bg-bg0 dark:border-gray0d dark:bg-bg0d'
const KICKER = 'font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d'

export const RunebondRequestsView = (): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nodeFilter = searchParams.get('node')
  const { isPrivate } = useApp()

  const { network, walletInfos, balanceByAddress, noThorAddress, reload } = useBondProviderData()
  const { getNodeInfos$, reloadNodeInfos, interact$, fees$ } = useThorchainContext()
  const { userNodes$ } = useUserNodesContext()
  const {
    keystoreService: { validatePassword$ }
  } = useWalletContext()
  const { validateAddress } = useValidateAddress(THORChain)
  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(THORChain))
  const nextChurn = useNextChurn()
  const { maxBondProviders } = useChurnConstants()

  const [feeRD] = useObservableState<FeeRD>(
    () =>
      FP.pipe(
        fees$(),
        liveData.map((fees) => fees.fast)
      ),
    RD.initial
  )

  const walletAddresses = useMemo(() => walletInfos.map(({ address }) => address), [walletInfos])
  const operatorNodesRD = useLastSuccessRD(useOperatorNodes({ walletAddresses, userNodes$, getNodeInfos$ }))
  const operatorAddresses = useMemo(
    () =>
      FP.pipe(
        operatorNodesRD,
        RD.map(operatorAddressesOf),
        RD.getOrElse<Error, Address[]>(() => [])
      ),
    [operatorNodesRD]
  )

  const requestsRD = useOperatorWhitelistRequests(operatorAddresses)
  const shownRequestsRD = useLastSuccessRD(requestsRD)

  const nodeInfosRD = useObservableState(getNodeInfos$, RD.initial)
  const shownNodeInfosRD = useLastSuccessRD(nodeInfosRD)
  const nodeByAddress = useMemo(
    () =>
      new Map(
        FP.pipe(
          shownNodeInfosRD,
          RD.getOrElse<Error, NodeInfo[]>(() => [])
        ).map((node) => [node.address, node])
      ),
    [shownNodeInfosRD]
  )

  const signerFor = useCallback(
    (node: NodeInfo): O.Option<BondWalletInfo> =>
      O.fromNullable(
        walletInfos.find(({ address }) => address.toLowerCase() === node.nodeOperatorAddress.toLowerCase())
      ),
    [walletInfos]
  )

  const { approve, oModalProps: oApproveModalProps } = useRunebondApprove({
    requestsRD,
    nodeInfosRD,
    reload,
    reloadNodeInfos,
    nodeByAddress,
    signerFor,
    balanceByAddress,
    modal: {
      network,
      maxBondProviders,
      nextChurn,
      fee: feeRD,
      interact$,
      validatePassword$,
      validateAddress,
      openExplorerTxUrl,
      getExplorerTxUrl
    }
  })

  const goBack = useCallback(() => navigate(bondsRoutes.basePathWithTab(bondsRoutes.BondsTab.NodeOperator)), [navigate])
  const showAllNodes = useCallback(() => navigate(bondsRoutes.runebondRequests.path()), [navigate])
  const openNode = useCallback(
    (nodeAddress: Address) =>
      navigate(bondsRoutes.node.path({ nodeAddress }), { state: { tab: bondsRoutes.BondsTab.NodeOperator } }),
    [navigate]
  )

  const amount = (value: BaseAmount) => (isPrivate ? hiddenString : formatRuneAmount(value))

  const operatedNodeAddresses = useMemo(
    () =>
      FP.pipe(
        operatorNodesRD,
        RD.map((nodes) => nodes.filter(({ isOperator }) => isOperator).map(({ address }) => address)),
        RD.getOrElse<Error, Address[]>(() => [])
      ),
    [operatorNodesRD]
  )

  const freeSlotsOf = (addresses: Address[]): O.Option<number> => {
    if (!RD.isSuccess(shownNodeInfosRD) || addresses.length === 0) return O.none
    let free = 0
    for (const address of new Set(addresses)) {
      const node = nodeByAddress.get(address)
      if (!node) return O.none
      free += Math.max(maxBondProviders - node.bondProviders.providers.length, 0)
    }
    return O.some(free)
  }

  const hasSigner = (node: NodeInfo) => O.isSome(signerFor(node))

  const renderRequestCard = (request: WhitelistRequest) => (
    <RunebondRequestCard
      key={request.id}
      request={request}
      network={network}
      isPrivate={isPrivate}
      nodesLoaded={RD.isSuccess(shownNodeInfosRD)}
      node={nodeByAddress.get(request.nodeAddress)}
      hasSigner={hasSigner}
      maxBondProviders={maxBondProviders}
      onOpenNode={openNode}
      onApprove={approve}
    />
  )

  const renderRequests = (data: OperatorWhitelistRequests) => {
    const inScope = ({ nodeAddress }: WhitelistRequest) => nodeFilter === null || nodeAddress === nodeFilter
    const pending = data.requests.filter((request) => request.status === 'pending' && inScope(request))
    const pendingTotal = pending.reduce((acc, { intendedBond }) => acc.plus(intendedBond), ZERO_BASE_AMOUNT)
    const slotScope =
      nodeFilter !== null
        ? [nodeFilter]
        : pending.length > 0
          ? pending.map(({ nodeAddress }) => nodeAddress)
          : operatedNodeAddresses
    const summary = FP.pipe(
      freeSlotsOf(slotScope),
      O.fold(
        () => intl.formatMessage({ id: 'bonds.runebond.requests.hero.summary' }, { amount: amount(pendingTotal) }),
        (free) =>
          intl.formatMessage({ id: 'bonds.runebond.requests.hero.summaryFree' }, { amount: amount(pendingTotal), free })
      )
    )

    return (
      <div className="flex w-full flex-col">
        <div className={`flex w-full flex-col px-6 py-[30px] lg:px-[34px] ${CARD}`}>
          <span className={KICKER}>{intl.formatMessage({ id: 'bonds.runebond.requests.hero.title' })}</span>
          <span className="mt-1 font-main text-[44px] leading-[1.05] text-text0 dark:text-text0d">
            {pending.length}
          </span>
          <span className="font-main text-[15px] text-gray2 dark:text-gray2d">{summary}</span>
        </div>

        {nodeFilter !== null && (
          <div className="mt-4 flex flex-wrap items-center gap-3 font-main text-[13px] text-gray2 dark:text-gray2d">
            <span>
              {intl.formatMessage(
                { id: 'bonds.runebond.requests.filter' },
                { node: truncateAddress(nodeFilter, THORChain, network) }
              )}
            </span>
            <BaseButton
              className="!p-0 font-main-semi-bold text-[12px] tracking-[1px] text-turquoise uppercase"
              onClick={showAllNodes}>
              {intl.formatMessage({ id: 'bonds.runebond.requests.showAll' })}
            </BaseButton>
          </div>
        )}

        {pending.length === 0 ? (
          <div className={`mt-4 flex w-full flex-col items-center px-6 py-[60px] text-center ${CARD}`}>
            <span className="font-main text-[17px] text-text0 dark:text-text0d">
              {intl.formatMessage({ id: 'bonds.runebond.requests.emptyTitle' })}
            </span>
            <span className="mt-1.5 font-main text-[14px] text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'bonds.runebond.requests.emptyBody' })}
            </span>
          </div>
        ) : (
          <div className="mt-4 grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pending.map(renderRequestCard)}
          </div>
        )}

        {data.requests.length < data.total && (
          <span className="mt-4 font-main text-[13px] text-gray2 dark:text-gray2d">
            {intl.formatMessage(
              { id: 'bonds.runebond.requests.truncated' },
              { shown: data.requests.length, total: data.total }
            )}
          </span>
        )}
      </div>
    )
  }

  const renderNoOperatorNodes = () => (
    <div className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray0 p-10 dark:border-gray0d">
      <span className="text-center font-main text-[14px] text-gray2 dark:text-gray2d">
        {intl.formatMessage({ id: 'bonds.operatorFees.page.noOperatorNodes' })}
      </span>
    </div>
  )

  const renderContent = () => {
    if (noThorAddress) return renderNoOperatorNodes()
    if (!RD.isSuccess(operatorNodesRD) || walletAddresses.length === 0) {
      return RD.isFailure(operatorNodesRD) ? (
        <ErrorView title={intl.formatMessage({ id: 'bonds.nodes.error' })} subTitle={operatorNodesRD.error.message} />
      ) : (
        <Spin className="m-auto" />
      )
    }
    if (operatorAddresses.length === 0) return renderNoOperatorNodes()
    return FP.pipe(
      shownRequestsRD,
      RD.fold(
        () => <Spin className="m-auto" />,
        () => <Spin className="m-auto" />,
        () => (
          <RunebondUnavailablePanel
            className="min-h-[280px]"
            message={intl.formatMessage({ id: 'bonds.runebond.requests.unavailable' })}
          />
        ),
        renderRequests
      )
    )
  }

  return (
    <div className="flex flex-col items-start">
      <div className="flex w-full flex-wrap items-center justify-between gap-4">
        <BaseButton className="group !p-0 font-main-semi-bold text-[14px] text-turquoise uppercase" onClick={goBack}>
          <ArrowLeftIcon className="mr-1 h-[16px] w-[16px] text-inherit transition-transform group-hover:-translate-x-[2px]" />
          {intl.formatMessage({ id: 'bonds.operator.detail.back' })}
        </BaseButton>
        <div className="flex items-center gap-2">
          <RunebondRefreshButton loading={RD.isPending(requestsRD)} disabled={operatorAddresses.length === 0} />
          <span className="font-main text-[13px] text-gray2 dark:text-gray2d">
            RUNEBond
            <span className="opacity-70">
              {' · '}
              {intl.formatMessage({ id: 'bonds.runebond.requests.integrationTag' })}
            </span>
          </span>
        </div>
      </div>
      <div className="mt-4 w-full">{renderContent()}</div>
      {FP.pipe(
        oApproveModalProps,
        O.fold(
          () => null,
          (props) => <NodeOperatorActionModal {...props} />
        )
      )}
    </div>
  )
}
