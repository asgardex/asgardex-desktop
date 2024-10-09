import React, { useCallback, useMemo } from 'react'

import { Balance, Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
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

import { DEFAULT_EVM_HD_MODE } from '../../../../shared/evm/types'
import { chainToString, EnabledChain } from '../../../../shared/utils/chain'
import { isKeystoreWallet } from '../../../../shared/utils/guard'
import { WalletType } from '../../../../shared/wallet/types'
import { CHAIN_WEIGHTS_THOR } from '../../../const'
import { isRuneNativeAsset, isUSDAsset } from '../../../helpers/assetHelper'
import { getDeepestPool, getPoolPriceValue } from '../../../helpers/poolHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { useDex } from '../../../hooks/useDex'
import * as poolsRoutes from '../../../routes/pools'
import { PoolsDataMap } from '../../../services/midgard/types'
import { MimirHaltRD, TradeAccount } from '../../../services/thorchain/types'
import { reloadBalancesByChain } from '../../../services/wallet'
import { SelectedWalletAsset, WalletBalance, WalletBalances } from '../../../services/wallet/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { PricePool } from '../../../views/pools/Pools.types'
import { Collapse } from '../../settings/Common.styles'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { ReloadButton } from '../../uielements/button'
import { Action as ActionButtonAction, ActionButton } from '../../uielements/button/ActionButton'
import * as Styled from './AssetsTableCollapsable.styles'

const { Panel } = Collapse

export type GetPoolPriceValueFnThor = (params: {
  balance: Balance
  poolDetails: PoolDetails
  pricePool: PricePool
}) => O.Option<BaseAmount>

type Props = {
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

export const TradeAssetsTableCollapsable: React.FC<Props> = ({
  disableRefresh,
  tradeAccountBalances,
  pricePool,
  poolsData,
  poolDetails,
  selectAssetHandler,
  // mimirHalt,
  network,
  hidePrivateData
}) => {
  const intl = useIntl()
  const navigate = useNavigate()
  const { dex } = useDex()
  const handleRefreshClick = useCallback((chain: Chain) => {
    const lazyReload = reloadBalancesByChain(chain)
    lazyReload()
  }, [])

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
    ({ asset, walletType, walletAddress }: WalletBalance) => {
      // const walletAsset: SelectedWalletAsset = { asset, walletAddress, walletAccount, walletIndex, walletType, hdMode }
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

      if (targetAsset && hasActivePool && dex.chain !== MAYAChain) {
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

      return (
        <div className="flex justify-center">
          <ActionButton size="normal" actions={actions} />
        </div>
      )
    },
    [dex, poolsData, poolDetails, intl, navigate]
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
      const keystoreAccounts = balances.filter((account) => account.walletType === 'keystore')
      const ledgerAccounts = balances.filter((account) => account.walletType === 'ledger')

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
    const keystoreBalances = tradeAccountBalances.filter((account) => account.walletType === 'keystore')
    const ledgerBalances = tradeAccountBalances.filter((account) => account.walletType === 'ledger')

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
          <Styled.HeaderLabel color="gray">{`(${
            walletType === 'keystore' ? keystoreBalances.length : ledgerBalances.length
          } Assets)`}</Styled.HeaderLabel>
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
                handleRefreshClick(THORChain)
              }}
            />
          </div>
        </Col>
      </Styled.HeaderRow>
    )

    return (
      <>
        {keystoreBalances.length > 0 && (
          <Panel header={renderHeader('keystore', O.fromNullable(keystoreBalances[0]))} key="keystore">
            <Styled.HeaderLabel className="ml-5">
              {intl.formatMessage({ id: 'common.tradeAccount' })}
            </Styled.HeaderLabel>
            {renderGroupedBalances({ balances: keystoreBalances })}
          </Panel>
        )}

        {ledgerBalances.length > 0 && (
          <Panel header={renderHeader('ledger', O.fromNullable(ledgerBalances[0]))} key="ledger">
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
        defaultActiveKey={['trade-account']}
        expandIconPosition="end"
        ghost>
        {renderPanel()}
      </Styled.Collapse>
    </>
  )
}
