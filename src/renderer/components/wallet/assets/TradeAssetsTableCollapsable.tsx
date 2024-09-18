import React, { useCallback, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Balance, Network } from '@xchainjs/xchain-client'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, BaseAmount, baseToAsset, Chain, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { Col, Row } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { DEFAULT_EVM_HD_MODE } from '../../../../shared/evm/types'
import { chainToString, EnabledChain } from '../../../../shared/utils/chain'
import { isKeystoreWallet } from '../../../../shared/utils/guard'
import { WalletType } from '../../../../shared/wallet/types'
import { CHAIN_WEIGHTS_THOR } from '../../../const'
import { isUSDAsset } from '../../../helpers/assetHelper'
import { getPoolPriceValue } from '../../../helpers/poolHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { PoolsDataMap } from '../../../services/midgard/types'
import { MimirHaltRD, TradeAccount, TradeAccountRD } from '../../../services/thorchain/types'
import { reloadBalancesByChain } from '../../../services/wallet'
import { ApiError, SelectedWalletAsset, WalletBalance, WalletBalances } from '../../../services/wallet/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { PricePool } from '../../../views/pools/Pools.types'
import { Collapse } from '../../settings/Common.styles'
import { ErrorView } from '../../shared/error'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { ReloadButton } from '../../uielements/button'
import { AssetAction } from './AssetsTableCollapsable'
import * as Styled from './AssetsTableCollapsable.styles'

const { Panel } = Collapse

export type GetPoolPriceValueFnThor = (params: {
  balance: Balance
  poolDetails: PoolDetails
  pricePool: PricePool
}) => O.Option<BaseAmount>

type Props = {
  disableRefresh: boolean
  tradeAccountBalances: TradeAccountRD
  pricePool: PricePool
  poolsData: PoolsDataMap
  poolDetails: PoolDetails
  pendingPoolDetails: PoolDetails
  selectAssetHandler: (asset: SelectedWalletAsset) => void
  assetHandler: (asset: SelectedWalletAsset, action: AssetAction) => void
  mimirHalt: MimirHaltRD
  network: Network
  hidePrivateData: boolean
}

export const TradeAssetsTableCollapsable: React.FC<Props> = ({
  disableRefresh,
  tradeAccountBalances,
  pricePool,
  // poolsData,
  poolDetails,
  selectAssetHandler,
  // mimirHalt,
  network,
  hidePrivateData
}) => {
  const intl = useIntl()
  // const navigate = useNavigate()
  const handleRefreshClick = useCallback((chain: Chain) => {
    const lazyReload = reloadBalancesByChain(chain)
    lazyReload()
  }, [])
  // store previous data of asset data to render these while reloading
  const previousAssetsTableData = useRef<WalletBalances[]>([])

  const iconColumn = useMemo(
    () => ({
      title: '',
      width: 120,
      render: ({ asset }: WalletBalance) => (
        <Row justify="center" align="middle">
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
              <Styled.ChainLabel>{asset.chain}</Styled.ChainLabel>
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

  const columns = useMemo(() => [iconColumn, tickerColumn, balanceColumn], [iconColumn, tickerColumn, balanceColumn])

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
          rowKey={({ asset }) => `${asset.chain}.${asset.symbol}`}
          columns={columns}
          onRow={onRowHandler}
        />
      )
    },
    [columns, onRowHandler]
  )

  const renderBalances = useCallback(
    ({ balancesRD, index }: { balancesRD: RD.RemoteData<ApiError, TradeAccount[]>; index: number }) => {
      return FP.pipe(
        balancesRD,
        RD.fold(
          () => renderAssetsTable({ tableData: [], loading: true }),
          () => {
            const data = previousAssetsTableData.current[index] ?? []
            return renderAssetsTable({ tableData: data, loading: true })
          },
          ({ msg }: ApiError) => {
            return <ErrorView title={msg} />
          },
          (tradeAccounts) => {
            const tableData = tradeAccounts.map((account) => ({
              asset: account.asset,
              amount: account.units,
              walletAddress: account.owner,
              walletType: account.walletType,
              walletIndex: 0,
              walletAccount: 0,
              hdMode: DEFAULT_EVM_HD_MODE
            }))
            return renderAssetsTable({ tableData, loading: false })
          }
        )
      )
    },
    [renderAssetsTable]
  )

  const renderPanel = useCallback(() => {
    if (RD.isInitial(tradeAccountBalances)) {
      return null
    }
    const ownerWalletType = FP.pipe(
      tradeAccountBalances,
      RD.toOption,
      O.chain((accounts) => O.fromNullable(accounts[0])),
      O.map((account) => account.walletType),
      O.getOrElse(() => 'keystore' as WalletType)
    )

    const header = (
      <Styled.HeaderRow className="flex w-full justify-between space-x-4">
        <Col flex="0 0 10rem" span={4}>
          <Styled.HeaderChainContainer>
            <Styled.HeaderLabel>{chainToString(THORChain)}</Styled.HeaderLabel>
            {!isKeystoreWallet(ownerWalletType) && (
              <Styled.WalletTypeLabel>{walletTypeToI18n(ownerWalletType, intl)}</Styled.WalletTypeLabel>
            )}
          </Styled.HeaderChainContainer>
        </Col>
        <Col flex={1} span={9}>
          <Styled.HeaderAddress>
            {hidePrivateData
              ? hiddenString
              : FP.pipe(
                  tradeAccountBalances,
                  RD.toOption,
                  O.chain((accounts) => O.fromNullable(accounts[0])),
                  O.map((account) => account.owner),
                  O.getOrElse(() => '')
                )}
          </Styled.HeaderAddress>
        </Col>
        <Col flex="0 1 auto" span={3} style={{ textAlign: 'right' }}>
          <Styled.HeaderLabel color={RD.isFailure(tradeAccountBalances) ? 'error' : 'gray'}>
            {RD.isSuccess(tradeAccountBalances) ? `(${tradeAccountBalances.value.length} Assets)` : ''}
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
                handleRefreshClick(THORChain)
              }}
            />
          </div>
        </Col>
      </Styled.HeaderRow>
    )

    return (
      <Panel header={header} key="trade-account">
        {RD.isSuccess(tradeAccountBalances) && (
          <>
            <Styled.Label>Trade Account</Styled.Label>
            {renderBalances({ balancesRD: tradeAccountBalances, index: 0 })}
          </>
        )}
      </Panel>
    )
  }, [tradeAccountBalances, intl, hidePrivateData, disableRefresh, renderBalances, handleRefreshClick])

  return (
    <>
      <Styled.Collapse defaultActiveKey={['trade-account']}>{renderPanel()}</Styled.Collapse>
    </>
  )
}
