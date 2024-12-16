import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Balance, Network } from '@xchainjs/xchain-client'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import {
  AnyAsset,
  assetFromString,
  assetToString,
  BaseAmount,
  baseToAsset,
  Chain,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import { Col, Row } from 'antd'
import { ColumnType } from 'antd/lib/table'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import * as Rx from 'rxjs'

import { DEFAULT_EVM_HD_MODE } from '../../../../shared/evm/types'
import { chainToString, EnabledChain } from '../../../../shared/utils/chain'
import { isKeystoreWallet } from '../../../../shared/utils/guard'
import { WalletType } from '../../../../shared/wallet/types'
import { CHAIN_WEIGHTS_THOR, ZERO_BASE_AMOUNT } from '../../../const'
import { useChainContext } from '../../../contexts/ChainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { isRuneNativeAsset, isUSDAsset } from '../../../helpers/assetHelper'
import { Action, getTradeMemo } from '../../../helpers/memoHelper'
import { getDeepestPool, getPoolPriceValue } from '../../../helpers/poolHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import * as poolsRoutes from '../../../routes/pools'
import { INITIAL_WITHDRAW_STATE } from '../../../services/chain/const'
import { TradeWithdrawParams, WithdrawState } from '../../../services/chain/types'
import { PoolsDataMap } from '../../../services/midgard/types'
import { MimirHaltRD, TradeAccount } from '../../../services/thorchain/types'
import { ChainBalances, SelectedWalletAsset, WalletBalance, WalletBalances } from '../../../services/wallet/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { PricePool } from '../../../views/pools/Pools.types'
import { ConfirmationModal, LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../../modal/confirmation'
import { TxModal } from '../../modal/tx'
import { DepositAsset } from '../../modal/tx/extra/DepositAsset'
import { Collapse } from '../../settings/Common.styles'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { AssetLabel } from '../../uielements/assets/assetLabel'
import { ReloadButton, ViewTxButton } from '../../uielements/button'
import { Action as ActionButtonAction, ActionButton } from '../../uielements/button/ActionButton'
import { Label } from './AssetDetails.styles'
import * as Styled from './AssetsTableCollapsable.styles'

const { Panel } = Collapse

export type GetPoolPriceValueFnThor = (params: {
  balance: Balance
  poolDetails: PoolDetails
  pricePool: PricePool
}) => O.Option<BaseAmount>

type Props = {
  chainBalances: Rx.Observable<ChainBalances>
  disableRefresh: boolean
  tradeAccountBalances: TradeAccount[]
  pricePool: PricePool
  poolsData: PoolsDataMap
  poolDetails: PoolDetails
  pendingPoolDetails: PoolDetails
  selectAssetHandler: (asset: SelectedWalletAsset) => void
  mimirHalt: MimirHaltRD
  network: Network
  hidePrivateData: boolean
}

type AssetAddressMap = Record<string, O.Option<string>>

export const TradeAssetsTableCollapsable: React.FC<Props> = ({
  chainBalances: chainBalances$,
  disableRefresh,
  tradeAccountBalances,
  pricePool,
  poolsData,
  poolDetails,
  selectAssetHandler,
  network,
  hidePrivateData
}) => {
  const intl = useIntl()
  const navigate = useNavigate()

  const { tradeWithdraw$ } = useChainContext()
  const {
    keystoreService: { validatePassword$ },
    reloadBalancesByChain
  } = useWalletContext()

  const handleRefreshClick = useCallback(
    (chain: Chain, walletType: WalletType) => {
      const lazyReload = reloadBalancesByChain(chain, walletType)
      lazyReload()
    },
    [reloadBalancesByChain]
  )

  const [assetToAddress, setAssetToAddress] = useState<AssetAddressMap>({})

  useEffect(() => {
    const subscription = chainBalances$.subscribe((chainBalances) => {
      const addressMap: AssetAddressMap = {}

      chainBalances.forEach(({ balances, walletAddress, walletType }) => {
        if (balances._tag === 'RemoteSuccess') {
          balances.value.forEach(({ asset }) => {
            addressMap[`${asset.chain.toUpperCase()}.${walletType}`] = walletAddress // Map symbol to address
          })
        }
      })

      setAssetToAddress(addressMap)
    })

    return () => {
      subscription.unsubscribe() // Cleanup subscription on unmount
    }
  }, [chainBalances$])

  type ModalState = 'confirm' | 'deposit' | 'none'
  const [showPasswordModal, setShowPasswordModal] = useState<ModalState>('none')
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState<ModalState>('none')
  const [showLedgerModal, setShowLedgerModal] = useState<ModalState>('none')

  const iconColumn = useMemo(
    () => ({
      title: '',
      width: 120,
      render: ({ asset }: WalletBalance) => (
        <Row className="relative" justify="center" align="middle">
          <AssetIcon asset={asset} size="normal" network={network} />
        </Row>
      )
    }),
    [network]
  )

  const { openExplorerTxUrl: openRuneExplorerTxUrl, getExplorerTxUrl: getRuneExplorerTxUrl } = useOpenExplorerTxUrl(
    O.some(THORChain)
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

  // Withdraw start time
  const [withdrawStartTime, setWithdrawStartTime] = useState<number>(0)

  const renderWithdrawConfirm = useMemo(() => {
    if (showWithdrawConfirm === 'none') return <></>

    const onClose = () => {
      setShowWithdrawConfirm('none')
    }

    const onSuccess = () => {
      FP.pipe(
        oTradeWithdrawParams,
        O.map((params) => params.walletType),
        O.fold(
          () => console.warn('No wallet type available'), // Fallback for None
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

    const content = () => {
      return FP.pipe(
        oTradeWithdrawParams,
        O.map((params) => (
          <div key={params.walletAddress}>
            <div className="flex-col">
              {intl.formatMessage({ id: 'common.withdraw' })}
              <div className="items-left justify-left m-2 flex">
                <AssetIcon className="flex-shrink-0" size="small" asset={params.asset} network={network} />
                <AssetLabel className="mx-2 flex-shrink-0" asset={params.asset} />
                <Label className="flex-shrink-0">
                  {formatAssetAmountCurrency({
                    asset: params.asset,
                    amount: baseToAsset(params.amount),
                    trimZeros: true
                  })}
                </Label>
              </div>

              <Label>{`With memo: ${params.memo}`}</Label>
            </div>
          </div>
        )),
        O.toNullable
      )
    }

    return (
      <ConfirmationModal
        onClose={onClose}
        onSuccess={onSuccess}
        visible={true}
        content={content()}
        title={intl.formatMessage({ id: 'common.withdraw' })}
      />
    )
  }, [intl, network, oTradeWithdrawParams, showWithdrawConfirm])

  const txModalExtraContentAsym = useMemo(() => {
    const assetWithAmount = FP.pipe(
      oTradeWithdrawParams,
      O.fold(
        // None case
        () => ({ asset: AssetRuneNative, amount: ZERO_BASE_AMOUNT }),
        // Some case
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
        // set start time
        setWithdrawStartTime(Date.now())
        // subscribe to tradeWithdraw$
        subscribeTradeWithdrawState(tradeWithdraw$(params))

        return true
      })
    )
  }, [oTradeWithdrawParams, subscribeTradeWithdrawState, tradeWithdraw$])

  const renderWithdrawTxModal = useMemo(() => {
    const { withdraw: withdrawRD, withdrawTx } = tradeWithdrawState

    // don't render TxModal in initial state
    if (RD.isInitial(withdrawRD)) return <></>

    // Get timer value
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

    // title
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
            onClick={openRuneExplorerTxUrl}
            txUrl={FP.pipe(oTxHash, O.chain(getRuneExplorerTxUrl))}
            label={intl.formatMessage({ id: 'common.tx.view' }, { assetTicker: AssetRuneNative.ticker })}
          />
        }
        extra={txModalExtraContentAsym}
      />
    )
  }, [
    tradeWithdrawState,
    onCloseTxModal,
    onFinishTxModal,
    withdrawStartTime,
    openRuneExplorerTxUrl,
    getRuneExplorerTxUrl,
    intl,
    txModalExtraContentAsym
  ])

  const renderLedgerConfirmationModal = useMemo(() => {
    if (showLedgerModal === 'none') return <></>

    const onClose = () => {
      setShowLedgerModal('none')
    }
    const onSuccess = () => {
      if (showLedgerModal === 'deposit') submitTradeWithdrawTx()
      setShowLedgerModal('none')
    }

    const chainAsString = chainToString(THORChain)
    const txtNeedsConnected = intl.formatMessage(
      {
        id: 'ledger.needsconnected'
      },
      { chain: chainAsString }
    )

    const description1 = txtNeedsConnected

    return (
      <LedgerConfirmationModal
        onSuccess={onSuccess}
        onClose={onClose}
        visible
        chain={THORChain}
        network={network}
        description1={description1}
        addresses={O.none}
      />
    )
  }, [intl, network, showLedgerModal, submitTradeWithdrawTx])

  const tickerColumn = useMemo(
    () => ({
      width: 80,
      render: ({ asset }: WalletBalance) => (
        <Styled.AssetTickerWrapper>
          <Styled.Label nowrap>
            <Styled.TickerLabel>{asset.ticker}</Styled.TickerLabel>
            <Styled.ChainLabelWrapper>
              <Styled.ChainLabel className="!text-turquoise">{THORChain}</Styled.ChainLabel>
            </Styled.ChainLabelWrapper>
          </Styled.Label>
        </Styled.AssetTickerWrapper>
      )
    }),
    []
  )

  const renderPasswordConfirmationModal = useMemo(() => {
    if (showPasswordModal === 'none') return <></>

    const onSuccess = () => {
      if (showPasswordModal === 'deposit') submitTradeWithdrawTx()
      setShowPasswordModal('none')
    }
    const onClose = () => {
      setShowPasswordModal('none')
    }

    return (
      <WalletPasswordConfirmationModal onSuccess={onSuccess} onClose={onClose} validatePassword$={validatePassword$} />
    )
  }, [showPasswordModal, submitTradeWithdrawTx, validatePassword$])

  const getAddressForAsset = (symbol: string, assetToAddress: AssetAddressMap): string =>
    O.getOrElse(() => 'Address not found')(assetToAddress[symbol] || O.none)
  const balanceColumn = useMemo(
    () => ({
      render: ({ asset, amount }: WalletBalance) => {
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
        const priceOption = getPoolPriceValue({
          balance: { asset, amount },
          poolDetails,
          pricePool
        })
        const price = formatPrice(priceOption, pricePool.asset)

        return (
          <div className="flex flex-col items-end justify-center font-main">
            <div className="text-16 text-text0 dark:text-text0d">{hidePrivateData ? hiddenString : balance}</div>
            <div className="text-14 text-gray2 dark:text-gray2d">{hidePrivateData ? hiddenString : price}</div>
          </div>
        )
      }
    }),
    [hidePrivateData, poolDetails, pricePool]
  )
  const renderActionColumn = useCallback(
    ({ asset, amount, walletType, walletAddress, walletAccount, walletIndex, hdMode }: WalletBalance) => {
      const normalizedAssetString = `${asset.chain}.${asset.symbol}`
      const hasActivePool: boolean = FP.pipe(O.fromNullable(poolsData[normalizedAssetString]), O.isSome)

      const deepestPoolAsset = FP.pipe(
        getDeepestPool(poolDetails),
        O.chain(({ asset }) => O.fromNullable(assetFromString(asset))),
        O.toNullable
      )

      const createAction = (labelId: string, callback: () => void) => ({
        label: intl.formatMessage({ id: labelId }),
        callback
      })

      const targetAsset =
        deepestPoolAsset && deepestPoolAsset.chain === asset.chain && deepestPoolAsset.symbol === asset.symbol
          ? AssetRuneNative
          : deepestPoolAsset

      const actions: ActionButtonAction[] = []

      if (targetAsset && hasActivePool) {
        actions.push(
          createAction('common.trade', () =>
            navigate(
              poolsRoutes.swap.path({
                source: assetToString(asset),
                target: isRuneNativeAsset(targetAsset)
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
            // Set withdraw parameters
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
                protocol: THORChain,
                hdMode
              })
            )

            // Show the confirm modal
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
    [poolsData, poolDetails, intl, navigate, network, assetToAddress]
  )

  const actionColumn: ColumnType<WalletBalance> = useMemo(
    () => ({
      width: 150,
      render: renderActionColumn
    }),
    [renderActionColumn]
  )

  const columns = useMemo(
    () => [iconColumn, tickerColumn, balanceColumn, actionColumn],
    [iconColumn, tickerColumn, actionColumn, balanceColumn]
  )

  const onRowHandler = useCallback(
    ({ asset, walletAddress, walletType, walletAccount, walletIndex, hdMode }: WalletBalance) => ({
      onClick: () => selectAssetHandler({ asset, walletAddress, walletAccount, walletType, walletIndex, hdMode })
    }),
    [selectAssetHandler]
  )

  const renderAssetsTable = useCallback(
    ({ tableData, loading }: { tableData: WalletBalances; loading?: boolean }) => {
      const sortedTableData = [...tableData].sort((a, b) => {
        const weightA = CHAIN_WEIGHTS_THOR[a.asset.chain as EnabledChain] ?? Infinity
        const weightB = CHAIN_WEIGHTS_THOR[b.asset.chain as EnabledChain] ?? Infinity
        return weightA - weightB
      })

      return (
        <Styled.Table
          showHeader={false}
          dataSource={sortedTableData}
          loading={loading}
          rowKey={({ asset, walletType }) => `${asset.chain}.${asset.symbol}.${walletType}`}
          columns={columns}
          onRow={onRowHandler}
        />
      )
    },
    [columns, onRowHandler]
  )

  const renderGroupedBalances = useCallback(
    ({ balances }: { balances: TradeAccount[] }) => {
      if (!balances || balances.length === 0) {
        return renderAssetsTable({ tableData: [], loading: true }) // No balances, render empty table
      }

      // Filter accounts by walletType
      const keystoreAccounts = balances.filter((account) => account.walletType === WalletType.Keystore)
      const ledgerAccounts = balances.filter((account) => account.walletType === WalletType.Ledger)

      return (
        <>
          {keystoreAccounts.length > 0 && (
            <div key="keystore">
              {renderAssetsTable({
                tableData: keystoreAccounts.map((account) => ({
                  asset: account.asset,
                  amount: account.units,
                  walletAddress: account.owner,
                  walletType: account.walletType,
                  walletIndex: 0,
                  walletAccount: 0,
                  hdMode: DEFAULT_EVM_HD_MODE
                })),
                loading: false
              })}
            </div>
          )}

          {ledgerAccounts.length > 0 && (
            <div key="ledger">
              {renderAssetsTable({
                tableData: ledgerAccounts.map((account) => ({
                  asset: account.asset,
                  amount: account.units,
                  walletAddress: account.owner,
                  walletType: account.walletType,
                  walletIndex: 0,
                  walletAccount: 0,
                  hdMode: DEFAULT_EVM_HD_MODE
                })),
                loading: false
              })}
            </div>
          )}
        </>
      )
    },
    [renderAssetsTable]
  )

  const renderPanel = useCallback(() => {
    // If tradeAccountBalances is empty, don't render anything
    if (!tradeAccountBalances || tradeAccountBalances.length === 0) {
      return null
    }

    // Group the balances by wallet type
    const keystoreBalances = tradeAccountBalances.filter((account) => account.walletType === WalletType.Keystore)
    const ledgerBalances = tradeAccountBalances.filter((account) => account.walletType === WalletType.Ledger)

    const renderHeader = (walletType: WalletType, firstAccount: O.Option<TradeAccount>) => (
      <Styled.HeaderRow className="flex w-full justify-between space-x-4">
        <Col flex="0 0 10rem" span={4}>
          <Styled.HeaderChainContainer>
            <Styled.HeaderLabel>{chainToString(THORChain)}</Styled.HeaderLabel>
            {!isKeystoreWallet(walletType) && (
              <Styled.WalletTypeLabel>{walletTypeToI18n(walletType, intl)}</Styled.WalletTypeLabel>
            )}
          </Styled.HeaderChainContainer>
        </Col>
        <Col flex={1} span={9}>
          <Styled.HeaderAddress>
            {hidePrivateData
              ? hiddenString
              : FP.pipe(
                  firstAccount,
                  O.map((account) => account.owner),
                  O.getOrElse(() => '')
                )}
          </Styled.HeaderAddress>
        </Col>
        <Col flex="0 1 auto" span={3} style={{ textAlign: 'right' }}>
          <Styled.HeaderLabel color="gray">
            {`(${walletType === WalletType.Keystore ? keystoreBalances.length : ledgerBalances.length} Assets)`}
          </Styled.HeaderLabel>
        </Col>
        <Col flex="0 0 12rem" span={1}>
          <div className="flex justify-end space-x-2 pr-4">
            <ReloadButton
              className="pr-2"
              size="small"
              color="neutral"
              disabled={disableRefresh}
              onClick={(event) => {
                event.stopPropagation()
                handleRefreshClick(THORChain, walletType)
              }}
            />
          </div>
        </Col>
      </Styled.HeaderRow>
    )

    return (
      <>
        {keystoreBalances.length > 0 && (
          <Panel header={renderHeader(WalletType.Keystore, O.fromNullable(keystoreBalances[0]))} key="keystore">
            <Styled.HeaderLabel className="ml-5">
              {intl.formatMessage({ id: 'common.tradeAccount' })}
            </Styled.HeaderLabel>
            {renderGroupedBalances({ balances: keystoreBalances })}
          </Panel>
        )}

        {ledgerBalances.length > 0 && (
          <Panel header={renderHeader(WalletType.Ledger, O.fromNullable(ledgerBalances[0]))} key="ledger">
            <Styled.HeaderLabel className="ml-5">
              {intl.formatMessage({ id: 'common.tradeAccount' })}
            </Styled.HeaderLabel>
            {renderGroupedBalances({ balances: ledgerBalances })}
          </Panel>
        )}
      </>
    )
  }, [tradeAccountBalances, intl, hidePrivateData, disableRefresh, renderGroupedBalances, handleRefreshClick])

  return (
    <>
      <Styled.Collapse
        expandIcon={({ isActive }) => <Styled.ExpandIcon rotate={isActive ? 90 : 0} />}
        defaultActiveKey={['keystore']}
        expandIconPosition="end"
        ghost>
        {renderPanel()}
        {renderWithdrawConfirm}
        {renderPasswordConfirmationModal}
        {renderWithdrawTxModal}
        {renderLedgerConfirmationModal}
      </Styled.Collapse>
    </>
  )
}
