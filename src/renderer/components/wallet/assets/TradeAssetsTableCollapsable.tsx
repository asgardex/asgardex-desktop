import { useCallback, useEffect, useMemo, useState } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { ColumnDef } from '@tanstack/react-table'
import { Balance, Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { PoolDetails as PoolDetailsMaya } from '@xchainjs/xchain-mayamidgard'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import {
  Address,
  AnyAsset,
  assetFromString,
  assetToString,
  BaseAmount,
  baseToAsset,
  Chain,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import * as Rx from 'rxjs'

import { DEFAULT_EVM_HD_MODE } from '../../../../shared/evm/types'
import { chainToString, EnabledChain } from '../../../../shared/utils/chain'
import { isKeystoreWallet } from '../../../../shared/utils/guard'
import { HDMode, WalletType } from '../../../../shared/wallet/types'
import { CHAIN_WEIGHTS_THOR, ZERO_BASE_AMOUNT } from '../../../const'
import { useChainContext } from '../../../contexts/ChainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { truncateAddress } from '../../../helpers/addressHelper'
import { isCacaoAsset, isRuneNativeAsset, isUSDAsset } from '../../../helpers/assetHelper'
import { Action, getTradeMemo } from '../../../helpers/memoHelper'
import { getDeepestPool, getPoolPriceValue } from '../../../helpers/poolHelper'
import {
  getPoolPriceValue as getPoolPriceValueMaya,
  getDeepestPool as getDeepestPoolM
} from '../../../helpers/poolHelperMaya'
import { hiddenString } from '../../../helpers/stringHelper'
import { useBreakpoint } from '../../../hooks/useBreakpoint'
import { useObserveMayaScanPrice } from '../../../hooks/useMayascanPrice'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import * as poolsRoutes from '../../../routes/pools'
import { INITIAL_WITHDRAW_STATE } from '../../../services/chain/const'
import { TradeWithdrawParams, WithdrawState } from '../../../services/chain/types'
import { PoolsDataMap, PricePool } from '../../../services/midgard/midgardTypes'
import { MimirHaltRD, TradeAccount } from '../../../services/thorchain/types'
import { ChainBalances, SelectedWalletAsset } from '../../../services/wallet/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { useApp } from '../../../store/app/hooks'
import { FixmeType } from '../../../types/asgardex'
import { ConfirmationModal, LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../modal/confirmation'
import { TxModal } from '../../modal/tx'
import { DepositAsset } from '../../modal/tx/extra/DepositAsset'
import { Table } from '../../table'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { AssetLabel } from '../../uielements/assets/assetLabel'
import { ViewTxButton } from '../../uielements/button'
import { Action as ActionButtonAction, ActionButton } from '../../uielements/button/ActionButton'
import { IconButton } from '../../uielements/button/IconButton'
import { Collapse } from '../../uielements/collapse'
import { WalletTypeLabel } from '../../uielements/common/Common.styles'
import { Label } from '../../uielements/label'
import * as Styled from './AssetsTableCollapsable.styles'

export type TradeWalletBalance = Balance & {
  walletAddress: Address
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
  protocol: Chain
}
export type TradeWalletBalances = TradeWalletBalance[]

type Props = {
  chainBalances: Rx.Observable<ChainBalances>
  disableRefresh: boolean
  tradeAccountBalances: TradeAccount[]
  pricePool: PricePool
  pricePoolMaya: PricePool
  poolsData: PoolsDataMap
  poolsDataMaya: PoolsDataMap
  poolDetails: PoolDetails
  poolDetailsMaya: PoolDetailsMaya
  pendingPoolDetails: PoolDetails
  pendingPoolDetailsMaya: PoolDetailsMaya
  selectAssetHandler: (asset: SelectedWalletAsset) => void
  mimirHalt: MimirHaltRD
  network: Network
  hidePrivateData: boolean
  refreshHandler: (protocol?: Chain) => void
  isRefreshing: boolean
}

type AssetAddressMap = Record<string, O.Option<string>>

export const TradeAssetsTableCollapsable = ({
  chainBalances: chainBalances$,
  disableRefresh,
  tradeAccountBalances,
  pricePool,
  pricePoolMaya,
  poolsData,
  poolsDataMaya,
  poolDetails,
  poolDetailsMaya,
  network,
  hidePrivateData,
  refreshHandler,
  isRefreshing
}: Props) => {
  const intl = useIntl()
  const navigate = useNavigate()
  const isXLargeView = useBreakpoint()?.xl ?? false
  const { mayaScanPriceRD } = useObserveMayaScanPrice()
  const { setProtocol } = useApp()

  const { tradeWithdraw$ } = useChainContext()
  const {
    keystoreService: { validatePassword$ }
  } = useWalletContext()

  const [assetToAddress, setAssetToAddress] = useState<AssetAddressMap>({})

  useEffect(() => {
    const subscription = chainBalances$.subscribe((chainBalances) => {
      const addressMap: AssetAddressMap = {}
      chainBalances.forEach(({ balances, walletAddress, walletType }) => {
        if (balances._tag === 'RemoteSuccess') {
          balances.value.forEach(({ asset }) => {
            addressMap[`${asset.chain.toUpperCase()}.${walletType}`] = walletAddress
          })
        }
      })
      setAssetToAddress(addressMap)
    })
    return () => subscription.unsubscribe()
  }, [chainBalances$])

  type ModalState = 'confirm' | 'deposit' | 'none'
  const [showPasswordModal, setShowPasswordModal] = useState<ModalState>('none')
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState<ModalState>('none')
  const [showLedgerModal, setShowLedgerModal] = useState<ModalState>('none')

  const { openExplorerTxUrl: openRuneExplorerTxUrl, getExplorerTxUrl: getRuneExplorerTxUrl } = useOpenExplorerTxUrl(
    O.some(THORChain)
  )
  const { openExplorerTxUrl: openMayaExplorerTxUrl, getExplorerTxUrl: getMayaExplorerTxUrl } = useOpenExplorerTxUrl(
    O.some(MAYAChain)
  )

  const {
    state: tradeWithdrawState,
    reset: resetTradeWithdrawState,
    subscribe: subscribeTradeWithdrawState
  } = useSubscriptionState<WithdrawState>(INITIAL_WITHDRAW_STATE)

  const [oTradeWithdrawParams, setTradeWithdrawParams] = useState<O.Option<TradeWithdrawParams>>(O.none)

  const onCloseTxModal = useCallback(() => {
    resetTradeWithdrawState()
  }, [resetTradeWithdrawState])

  const onFinishTxModal = useCallback(() => {
    onCloseTxModal()
  }, [onCloseTxModal])

  const [withdrawStartTime, setWithdrawStartTime] = useState<number>(0)

  const renderWithdrawConfirm = useMemo(() => {
    if (showWithdrawConfirm === 'none') return <></>

    const onClose = () => setShowWithdrawConfirm('none')

    const onSuccess = () => {
      FP.pipe(
        oTradeWithdrawParams,
        O.map((params) => params.walletType),
        O.fold(
          () => console.warn('No wallet type available'),
          (walletType) => {
            if (walletType === WalletType.Ledger) {
              setShowLedgerModal('deposit')
            } else {
              setShowPasswordModal('deposit')
            }
          }
        )
      )
    }

    const content = () =>
      FP.pipe(
        oTradeWithdrawParams,
        O.map((params) => (
          <div key={params.walletAddress}>
            <div className="flex-col">
              <div className="m-2 flex items-center justify-between">
                <div className="flex items-center">
                  <AssetIcon className="flex-shrink-0" size="small" asset={params.asset} network={network} />
                  <AssetLabel className="mx-2 flex-shrink-0" asset={params.asset} />
                </div>
                <span className="flex-shrink-0 text-16 text-text0 dark:text-text0d">
                  {formatAssetAmountCurrency({
                    asset: params.asset,
                    amount: baseToAsset(params.amount),
                    trimZeros: true
                  })}
                </span>
              </div>
              <div className="mx-3 mt-5 flex flex-col">
                <span className="m-0 font-main text-[14px] text-gray2 dark:text-gray2d">
                  {intl.formatMessage({ id: 'common.memo' })}
                </span>
                <div className="truncate font-main text-[14px] text-text0 dark:text-text0d">{params.memo}</div>
              </div>
            </div>
          </div>
        )),
        O.toNullable
      )

    return (
      <ConfirmationModal
        visible
        title={intl.formatMessage({ id: 'common.withdraw' })}
        content={content()}
        onSuccess={onSuccess}
        onClose={onClose}
      />
    )
  }, [intl, network, oTradeWithdrawParams, showWithdrawConfirm])

  const txModalExtraContentAsym = useMemo(() => {
    const assetWithAmount = FP.pipe(
      oTradeWithdrawParams,
      O.fold(
        () => ({ asset: AssetRuneNative, amount: ZERO_BASE_AMOUNT }),
        (params) => ({ asset: params.asset, amount: params.amount })
      )
    )
    const stepDescriptions = [
      intl.formatMessage({ id: 'common.tx.healthCheck' }),
      intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: assetWithAmount.asset.ticker }),
      intl.formatMessage({ id: 'common.tx.checkResult' })
    ]
    const stepDescription = FP.pipe(
      tradeWithdrawState.withdraw,
      RD.fold(
        () => '',
        () =>
          `${intl.formatMessage(
            { id: 'common.step' },
            { current: tradeWithdrawState.step, total: tradeWithdrawState.stepsTotal }
          )}: ${stepDescriptions[tradeWithdrawState.step - 1]}`,
        () => '',
        () => `${intl.formatMessage({ id: 'common.done' })}!`
      )
    )

    return (
      <DepositAsset
        source={O.some({ asset: assetWithAmount.asset, amount: assetWithAmount.amount })}
        stepDescription={stepDescription}
        network={network}
      />
    )
  }, [
    intl,
    network,
    oTradeWithdrawParams,
    tradeWithdrawState.step,
    tradeWithdrawState.stepsTotal,
    tradeWithdrawState.withdraw
  ])

  const submitTradeWithdrawTx = useCallback(() => {
    FP.pipe(
      oTradeWithdrawParams,
      O.map((params) => {
        setWithdrawStartTime(Date.now())
        subscribeTradeWithdrawState(tradeWithdraw$(params))
        return true
      })
    )
  }, [oTradeWithdrawParams, subscribeTradeWithdrawState, tradeWithdraw$])

  const renderWithdrawTxModal = useMemo(() => {
    const { withdraw: withdrawRD, withdrawTx } = tradeWithdrawState
    if (RD.isInitial(withdrawRD)) return <></>

    const timerValue = FP.pipe(
      withdrawRD,
      RD.fold(
        () => 0,
        FP.flow(
          O.map(({ loaded }) => loaded),
          O.getOrElse(() => 0)
        ),
        () => 0,
        () => 100
      )
    )

    const txModalTitle = FP.pipe(
      withdrawRD,
      RD.fold(
        () => 'common.withdraw',
        () => 'common.tx.sending',
        () => 'common.tx.checkResult',
        () => 'common.tx.success'
      ),
      (id) => intl.formatMessage({ id })
    )

    const oTxHash = FP.pipe(
      RD.toOption(withdrawTx),
      O.map((txHash) => txHash)
    )

    const oProtocol = FP.pipe(
      oTradeWithdrawParams,
      O.map((params) => params.protocol)
    )
    const protocolAsset = FP.pipe(
      oProtocol,
      O.map((protocol) => (protocol === THORChain ? AssetRuneNative : AssetCacao)),
      O.getOrElse(() => AssetRuneNative)
    )
    return (
      <TxModal
        title={txModalTitle}
        onClose={onCloseTxModal}
        onFinish={onFinishTxModal}
        startTime={withdrawStartTime}
        txRD={withdrawRD}
        timerValue={timerValue}
        extraResult={
          <ViewTxButton
            txHash={oTxHash}
            onClick={FP.pipe(
              oProtocol,
              O.map((protocol) => (protocol === THORChain ? openRuneExplorerTxUrl : openMayaExplorerTxUrl)),
              O.getOrElse(() => openRuneExplorerTxUrl)
            )}
            txUrl={FP.pipe(
              oTxHash,
              O.chain((txHash) =>
                FP.pipe(
                  oProtocol,
                  O.map((protocol) => (protocol === THORChain ? getRuneExplorerTxUrl : getMayaExplorerTxUrl)(txHash)),
                  O.getOrElse(() => getRuneExplorerTxUrl(txHash))
                )
              )
            )}
            label={intl.formatMessage({ id: 'common.tx.view' }, { assetTicker: protocolAsset.ticker })}
          />
        }
        extra={txModalExtraContentAsym}
      />
    )
  }, [
    tradeWithdrawState,
    oTradeWithdrawParams,
    onCloseTxModal,
    onFinishTxModal,
    withdrawStartTime,
    intl,
    txModalExtraContentAsym,
    openRuneExplorerTxUrl,
    openMayaExplorerTxUrl,
    getRuneExplorerTxUrl,
    getMayaExplorerTxUrl
  ])

  const renderLedgerConfirmationModal = useMemo(() => {
    if (showLedgerModal === 'none') return <></>

    const onClose = () => setShowLedgerModal('none')
    const onSuccess = () => {
      if (showLedgerModal === 'deposit') submitTradeWithdrawTx()
      setShowLedgerModal('none')
    }

    const chainAsString = FP.pipe(
      oTradeWithdrawParams,
      O.map((params) => chainToString(params.protocol === THORChain ? THORChain : MAYAChain)),
      O.getOrElse(() => chainToString(THORChain))
    )
    const txtNeedsConnected = intl.formatMessage({ id: 'ledger.needsconnected' }, { chain: chainAsString })

    return (
      <LedgerConfirmationModal
        onSuccess={onSuccess}
        onClose={onClose}
        visible
        chain={FP.pipe(
          oTradeWithdrawParams,
          O.map((params) => (params.protocol === THORChain ? THORChain : MAYAChain)),
          O.getOrElse(() => chainToString(THORChain))
        )}
        network={network}
        description1={txtNeedsConnected}
        addresses={O.none}
      />
    )
  }, [intl, network, showLedgerModal, submitTradeWithdrawTx, oTradeWithdrawParams])

  const renderPasswordConfirmationModal = useMemo(() => {
    if (showPasswordModal === 'none') return <></>

    const onSuccess = () => {
      if (showPasswordModal === 'deposit') submitTradeWithdrawTx()
      setShowPasswordModal('none')
    }
    const onClose = () => setShowPasswordModal('none')

    return (
      <WalletPasswordConfirmationModal onSuccess={onSuccess} onClose={onClose} validatePassword$={validatePassword$} />
    )
  }, [showPasswordModal, submitTradeWithdrawTx, validatePassword$])

  const getAddressForAsset = (symbol: string, assetToAddress: AssetAddressMap): string =>
    O.getOrElse(() => 'Address not found')(assetToAddress[symbol] || O.none)

  const renderActionColumn = useCallback(
    ({
      asset,
      amount,
      walletType,
      walletAddress,
      walletAccount,
      walletIndex,
      hdMode,
      protocol
    }: TradeWalletBalance) => {
      const normalizedAssetString = `${asset.chain}.${asset.symbol}`
      const poolsDataToUse = protocol === MAYAChain ? poolsDataMaya : poolsData
      const hasActivePool = FP.pipe(O.fromNullable(poolsDataToUse[normalizedAssetString]), O.isSome)

      const deepestPoolAsset =
        protocol === MAYAChain
          ? FP.pipe(
              getDeepestPoolM(poolDetailsMaya),
              O.chain(({ asset }) => O.fromNullable(assetFromString(asset))),
              O.toNullable
            )
          : FP.pipe(
              getDeepestPool(poolDetails),
              O.chain(({ asset }) => O.fromNullable(assetFromString(asset))),
              O.toNullable
            )

      const createAction = (labelId: string, callback: () => void) => ({
        label: intl.formatMessage({ id: labelId }),
        callback: () => {
          setProtocol(protocol)
          callback()
        }
      })

      const targetAsset =
        deepestPoolAsset && deepestPoolAsset.chain === asset.chain && deepestPoolAsset.symbol === asset.symbol
          ? protocol === MAYAChain
            ? AssetCacao
            : AssetRuneNative
          : deepestPoolAsset

      const actions: ActionButtonAction[] = []

      if (targetAsset && hasActivePool) {
        actions.push(
          createAction('common.trade', () =>
            navigate(
              poolsRoutes.swap.path({
                source: assetToString(asset),
                target:
                  isRuneNativeAsset(targetAsset) || isCacaoAsset(targetAsset)
                    ? assetToString(targetAsset)
                    : `${targetAsset.chain}~${targetAsset.symbol}`,
                sourceWalletType: walletType,
                targetWalletType: walletType,
                recipient: walletAddress
              })
            )
          )
        )
      }
      if (targetAsset && hasActivePool) {
        actions.push(
          createAction('common.withdraw', () => {
            setTradeWithdrawParams(
              O.some({
                asset,
                amount,
                walletAddress,
                walletType,
                walletAccount,
                walletIndex,
                network,
                memo: getTradeMemo(
                  Action.withdraw,
                  getAddressForAsset(`${asset.chain.toUpperCase()}.${walletType}`, assetToAddress)
                ),
                protocol,
                hdMode
              })
            )
            setShowWithdrawConfirm('confirm')
          })
        )
      }

      return (
        <div className="flex justify-center">
          <ActionButton size="normal" actions={actions} />
        </div>
      )
    },
    [poolsDataMaya, poolsData, poolDetailsMaya, poolDetails, intl, setProtocol, navigate, network, assetToAddress]
  )

  const columns: ColumnDef<TradeWalletBalance, FixmeType>[] = useMemo(
    () => [
      {
        accessorKey: 'asset',
        header: '',
        cell: ({ row }) => {
          const { asset, protocol } = row.original
          return (
            <div className="flex items-center space-x-2">
              <AssetIcon asset={asset} size="normal" network={network} />
              <div className="flex flex-col">
                <Label className="!text-16 !leading-[18px]" textTransform="uppercase" weight="bold">
                  {asset.ticker}
                </Label>
                <Label color="primary" weight="bold">
                  {protocol}
                </Label>
              </div>
            </div>
          )
        }
      },
      {
        accessorKey: 'balance',
        header: '',
        cell: ({ row }) => {
          const { asset, amount, protocol } = row.original
          const balance = formatAssetAmountCurrency({ amount: baseToAsset(amount), asset, decimal: 3 })
          const formatPrice = (priceOption: O.Option<BaseAmount>, pricePoolAsset: AnyAsset) => {
            if (O.isSome(priceOption)) {
              return formatAssetAmountCurrency({
                amount: baseToAsset(priceOption.value),
                asset: pricePoolAsset,
                decimal: isUSDAsset(pricePoolAsset) ? 2 : 4
              })
            }
            return null
          }
          const priceOption =
            protocol === MAYAChain
              ? getPoolPriceValueMaya({
                  balance: { asset, amount },
                  poolDetails: poolDetailsMaya,
                  pricePool: pricePoolMaya,
                  mayaPriceRD: mayaScanPriceRD
                })
              : getPoolPriceValue({
                  balance: { asset, amount },
                  poolDetails,
                  pricePool
                })
          const price = formatPrice(priceOption, protocol === MAYAChain ? pricePoolMaya.asset : pricePool.asset)
          return (
            <div className="flex flex-col items-end justify-center font-main">
              <div className="text-16 text-text0 dark:text-text0d">{hidePrivateData ? hiddenString : balance}</div>
              <div className="text-14 text-gray2 dark:text-gray2d">{hidePrivateData ? hiddenString : price}</div>
            </div>
          )
        }
      },
      {
        accessorKey: 'actions',
        header: '',
        cell: ({ row }) => renderActionColumn(row.original),
        size: isXLargeView ? 120 : 250
      }
    ],
    [
      hidePrivateData,
      isXLargeView,
      mayaScanPriceRD,
      network,
      poolDetails,
      poolDetailsMaya,
      pricePool,
      pricePoolMaya,
      renderActionColumn
    ]
  )

  const renderAssetsTable = useCallback(
    ({ tableData, loading }: { tableData: TradeWalletBalances; loading?: boolean }) => {
      const sortedTableData = [...tableData].sort((a, b) => {
        const weightA = CHAIN_WEIGHTS_THOR[a.asset.chain as EnabledChain] ?? Infinity
        const weightB = CHAIN_WEIGHTS_THOR[b.asset.chain as EnabledChain] ?? Infinity
        return weightA - weightB
      })
      return (
        <Table
          columns={columns}
          data={sortedTableData}
          hideHeader
          hideVerticalBorder
          loading={loading || isRefreshing}
        />
      )
    },
    [columns, isRefreshing]
  )

  const renderGroupedBalances = useCallback(
    ({ balances }: { balances: TradeAccount[] }) => {
      if (!balances || balances.length === 0) {
        return renderAssetsTable({ tableData: [], loading: true })
      }

      const keystoreAccounts = balances.filter((account) => account.walletType === WalletType.Keystore)
      const ledgerAccounts = balances.filter((account) => account.walletType === WalletType.Ledger)

      // Group accounts by protocol for each wallet type
      const groupByProtocol = (accounts: TradeAccount[]): Record<string, TradeAccount[]> =>
        accounts.reduce((acc, account) => {
          const protocol = account.protocol.toLowerCase()
          acc[protocol] = [...(acc[protocol] || []), account]
          return acc
        }, {} as Record<string, TradeAccount[]>)

      const keystoreByProtocol = groupByProtocol(keystoreAccounts)
      const ledgerByProtocol = groupByProtocol(ledgerAccounts)

      return (
        <>
          {Object.entries(keystoreByProtocol).map(
            ([protocol, accounts]) =>
              accounts.length > 0 && (
                <div key={`keystore-${protocol}`}>
                  {renderAssetsTable({
                    tableData: accounts.map((account) => ({
                      asset: account.asset,
                      amount: account.units,
                      walletAddress: account.owner,
                      walletType: account.walletType,
                      walletIndex: 0,
                      walletAccount: 0,
                      hdMode: DEFAULT_EVM_HD_MODE,
                      protocol: account.protocol
                    })),
                    loading: isRefreshing
                  })}
                </div>
              )
          )}
          {Object.entries(ledgerByProtocol).map(
            ([protocol, accounts]) =>
              accounts.length > 0 && (
                <div key={`ledger-${protocol}`}>
                  {renderAssetsTable({
                    tableData: accounts.map((account) => ({
                      asset: account.asset,
                      amount: account.units,
                      walletAddress: account.owner,
                      walletType: account.walletType,
                      walletIndex: 0,
                      walletAccount: 0,
                      hdMode: DEFAULT_EVM_HD_MODE,
                      protocol: account.protocol
                    })),
                    loading: isRefreshing
                  })}
                </div>
              )
          )}
        </>
      )
    },
    [renderAssetsTable, isRefreshing]
  )

  const renderContent = useCallback(() => {
    if (!tradeAccountBalances || tradeAccountBalances.length === 0) {
      return null
    }

    const balancesByChainAndWalletType: Record<string, TradeAccount[]> = tradeAccountBalances.reduce((acc, account) => {
      const key = `${account.protocol}.${account.walletType}`
      acc[key] = [...(acc[key] || []), account]
      return acc
    }, {} as Record<string, TradeAccount[]>)

    return Object.entries(balancesByChainAndWalletType).map(([key, balances]) => {
      const [protocol, walletType] = key.split('.')
      const chain = protocol === 'Thorchain' ? THORChain : MAYAChain
      const firstAccount = balances[0]
      const fullWalletAddress = FP.pipe(
        O.fromNullable(firstAccount),
        O.map((account) => account.owner),
        O.getOrElse(() => '')
      )
      const truncatedWalletAddress = FP.pipe(
        O.fromNullable(firstAccount),
        O.map((account) => truncateAddress(account.owner, chain, network)),
        O.getOrElse(() => '')
      )

      const renderHeader = () => (
        <div className="flex w-full justify-between space-x-4">
          <div className="flex flex-row items-center space-x-2">
            <Label className="!w-auto" textTransform="uppercase">
              {protocol}
            </Label>
            {!isKeystoreWallet(walletType as WalletType) && (
              <WalletTypeLabel className="bg-bg2 dark:bg-bg2d border border-solid border-gray0 dark:border-gray0d">
                {walletTypeToI18n(walletType as WalletType, intl)}
              </WalletTypeLabel>
            )}
            <Label className="!w-auto" color="gray" textTransform="uppercase">
              {`(${balances.length} Assets)`}
            </Label>
          </div>
          <div className="flex items-center justify-end space-x-2">
            <Label className="flex items-center text-text0 dark:text-text0d" color="gray" textTransform="none">
              {hidePrivateData ? hiddenString : truncatedWalletAddress}
              <Styled.CopyLabel copyable={{ text: fullWalletAddress }} />
            </Label>
            <div className="flex items-center justify-end space-x-2 pr-4">
              <IconButton
                disabled={disableRefresh}
                onClick={(e) => {
                  e.stopPropagation()
                  refreshHandler(protocol)
                }}>
                <ArrowPathIcon className="ease h-5 w-5 text-text0 group-hover:rotate-180 dark:text-text0d" />
              </IconButton>
            </div>
          </div>
        </div>
      )

      return (
        <Collapse className="bg-bg0 dark:bg-bg0d" isOpen header={renderHeader()} key={key}>
          {renderGroupedBalances({ balances })}
        </Collapse>
      )
    })
  }, [tradeAccountBalances, renderGroupedBalances, intl, hidePrivateData, disableRefresh, network, refreshHandler])

  return (
    <div className="mt-2">
      {renderContent()}
      {renderWithdrawConfirm}
      {renderPasswordConfirmationModal}
      {renderWithdrawTxModal}
      {renderLedgerConfirmationModal}
    </div>
  )
}
