import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Balance, Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import {
  Address,
  AnyAsset,
  Asset,
  assetFromString,
  assetToString,
  AssetType,
  BaseAmount,
  baseToAsset,
  Chain,
  formatAssetAmountCurrency,
  isSynthAsset
} from '@xchainjs/xchain-util'
import { Col, Collapse, Grid, Row } from 'antd'
import { ScreenMap } from 'antd/lib/_util/responsiveObserve'
import { ColumnType } from 'antd/lib/table'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router'

import { Dex } from '../../../../shared/api/types'
import { AssetRuneNative } from '../../../../shared/utils/asset'
import { chainToString, EnabledChain, isChainOfMaya, isChainOfThor } from '../../../../shared/utils/chain'
import { isKeystoreWallet } from '../../../../shared/utils/guard'
import { DEFAULT_WALLET_TYPE, ZERO_BASE_AMOUNT } from '../../../const'
import { isCacaoAsset, isMayaAsset, isRuneNativeAsset, isUSDAsset } from '../../../helpers/assetHelper'
import { getChainAsset } from '../../../helpers/chainHelper'
import { isEvmChain } from '../../../helpers/evmHelper'
import { getDeepestPool, getPoolPriceValue } from '../../../helpers/poolHelper'
import { getPoolPriceValue as getPoolPriceValueM } from '../../../helpers/poolHelperMaya'
import { hiddenString, noDataString } from '../../../helpers/stringHelper'
import { calculateMayaValueInUSD, MayaScanPriceRD } from '../../../hooks/useMayascanPrice'
import * as poolsRoutes from '../../../routes/pools'
import { WalletBalancesRD } from '../../../services/clients'
import { PoolDetails as PoolDetailsMaya } from '../../../services/mayaMigard/types'
import { PoolDetails, PoolsDataMap } from '../../../services/midgard/types'
import { MimirHaltRD } from '../../../services/thorchain/types'
import { reloadBalancesByChain } from '../../../services/wallet'
import {
  ApiError,
  ChainBalance,
  ChainBalances,
  SelectedWalletAsset,
  WalletBalance,
  WalletBalances
} from '../../../services/wallet/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { PricePool } from '../../../views/pools/Pools.types'
import { ErrorView } from '../../shared/error/'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { FlatButton } from '../../uielements/button'
import { Action as ActionButtonAction, ActionButton } from '../../uielements/button/ActionButton'
import { ReloadButton } from '../../uielements/button/ReloadButton'
import { InfoIcon } from '../../uielements/info'
import { QRCodeModal } from '../../uielements/qrCodeModal/QRCodeModal'
import * as Styled from './AssetsTableCollapsable.styles'

const { Panel } = Collapse

export type AssetAction = 'send' | 'deposit'

export type GetPoolPriceValueFnThor = (params: {
  balance: Balance
  poolDetails: PoolDetails
  pricePool: PricePool
}) => O.Option<BaseAmount>

export type GetPoolPriceValueFnMaya = (params: {
  balance: Balance
  poolDetails: PoolDetailsMaya
  pricePool: PricePool
}) => O.Option<BaseAmount>

type Props = {
  disableRefresh: boolean
  chainBalances: ChainBalances
  pricePool: PricePool
  mayaPricePool: PricePool
  poolDetails: PoolDetails
  poolDetailsMaya: PoolDetailsMaya
  pendingPoolDetails: PoolDetails
  pendingPoolsDetailsMaya: PoolDetailsMaya
  poolsData: PoolsDataMap
  poolsDataMaya: PoolsDataMap
  selectAssetHandler: (asset: SelectedWalletAsset) => void
  assetHandler: (asset: SelectedWalletAsset, action: AssetAction) => void
  network: Network
  mimirHalt: MimirHaltRD
  hidePrivateData: boolean
  dex: Dex
  mayaScanPrice: MayaScanPriceRD
  disabledChains: EnabledChain[]
}

export const AssetsTableCollapsable: React.FC<Props> = (props): JSX.Element => {
  const {
    disableRefresh,
    chainBalances = [],
    pricePool,
    mayaPricePool,
    poolDetails,
    poolDetailsMaya,
    pendingPoolDetails,
    poolsData,
    poolsDataMaya,
    selectAssetHandler,
    assetHandler,
    network,
    hidePrivateData,
    dex,
    mayaScanPrice,
    disabledChains
  } = props

  const intl = useIntl()
  const navigate = useNavigate()
  const screenMap: ScreenMap = Grid.useBreakpoint()

  const [showQRModal, setShowQRModal] = useState<O.Option<{ asset: Asset; address: Address }>>(O.none)

  const [filterByValue, setFilterByValue] = useState(() => {
    const cachedValue = localStorage.getItem('filterByValue')
    return cachedValue ? JSON.parse(cachedValue) : true
  })

  useEffect(() => {
    localStorage.setItem('filterByValue', JSON.stringify(filterByValue))
  }, [filterByValue])

  const [openPanelKeys, setOpenPanelKeys] = useState<string[]>(() => {
    const cachedKeys = localStorage.getItem('openPanelKeys')
    return cachedKeys ? JSON.parse(cachedKeys) : []
  })

  useEffect(() => {
    localStorage.setItem('openPanelKeys', JSON.stringify(openPanelKeys))
  }, [openPanelKeys])

  const [allPanelKeys, setAllPanelKeys] = useState<string[]>()
  const [collapseChangedByUser, setCollapseChangedByUser] = useState(false)
  const [collapseAll, setCollapseAll] = useState<boolean>(false)

  const handleRefreshClick = (chain: Chain) => {
    const lazyReload = reloadBalancesByChain(chain)
    lazyReload()
  }

  // store previous data of asset data to render these while reloading
  const previousAssetsTableData = useRef<WalletBalances[]>([])

  const handleCollapseAll = useCallback(() => {
    if (collapseAll) {
      localStorage.setItem('openPanelKeys', JSON.stringify(openPanelKeys))
      setOpenPanelKeys([])
    } else {
      const previousOpenKeys = allPanelKeys ? allPanelKeys : ['0', '1', '2']
      setOpenPanelKeys(previousOpenKeys)
    }
    setCollapseAll(!collapseAll)
  }, [allPanelKeys, collapseAll, openPanelKeys])

  const onRowHandler = useCallback(
    ({ asset, walletAddress, walletType, walletAccount, walletIndex, hdMode }: WalletBalance) => ({
      onClick: () => selectAssetHandler({ asset, walletAddress, walletAccount, walletType, walletIndex, hdMode })
    }),
    [selectAssetHandler]
  )

  const iconColumn: ColumnType<WalletBalance> = useMemo(
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

  const tickerColumn: ColumnType<WalletBalance> = useMemo(
    () => ({
      width: 80,
      render: ({ asset }: WalletBalance) => (
        <Styled.AssetTickerWrapper>
          <Styled.Label nowrap>
            <Styled.TickerLabel>{asset.ticker}</Styled.TickerLabel>
            <Styled.ChainLabelWrapper>
              {!isSynthAsset(asset) && <Styled.ChainLabel>{asset.chain}</Styled.ChainLabel>}
              {isSynthAsset(asset) && <Styled.AssetSynthLabel>synth</Styled.AssetSynthLabel>}
            </Styled.ChainLabelWrapper>
          </Styled.Label>
        </Styled.AssetTickerWrapper>
      )
    }),
    []
  )

  const balanceColumn: ColumnType<WalletBalance> = useMemo(
    () => ({
      render: ({ asset, amount }: WalletBalance) => {
        const balance = formatAssetAmountCurrency({ amount: baseToAsset(amount), asset, decimal: 3 })
        let price: string = noDataString // Default to "no data" string

        // Helper function to format price
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

        // Helper function to get price from pool details
        const getPriceThor = (
          getPoolPriceValueFn: GetPoolPriceValueFnThor,
          poolDetails: PoolDetails,
          pricePool: PricePool
        ) => {
          const priceOption = getPoolPriceValueFn({
            balance: { asset, amount },
            poolDetails,
            pricePool
          })
          return formatPrice(priceOption, pricePool.asset)
        }

        const getPriceMaya = (
          getPoolPriceValueFn: GetPoolPriceValueFnMaya,
          poolDetails: PoolDetailsMaya,
          pricePool: PricePool
        ) => {
          const priceOption = getPoolPriceValueFn({
            balance: { asset, amount },
            poolDetails,
            pricePool
          })
          return formatPrice(priceOption, pricePool.asset)
        }

        // USD Asset case
        if (isUSDAsset(asset)) {
          price = balance.toString()
        } else {
          if (isChainOfMaya(asset.chain) && isChainOfThor(asset.chain)) {
            // Chain is supported by both MAYA and THOR, prioritize THOR
            price =
              getPriceThor(getPoolPriceValue, poolDetails as PoolDetails, pricePool) ||
              getPriceMaya(getPoolPriceValueM, poolDetailsMaya as PoolDetailsMaya, mayaPricePool) ||
              price
          } else if (isChainOfMaya(asset.chain)) {
            // Chain is supported only by MAYA
            price = getPriceMaya(getPoolPriceValueM, poolDetailsMaya as PoolDetailsMaya, mayaPricePool) || price
          } else if (isChainOfThor(asset.chain)) {
            // Chain is supported only by THOR
            price = getPriceThor(getPoolPriceValue, poolDetails as PoolDetails, pricePool) || price
          } else {
            // Handle pending pool details
            const priceOptionFromPendingPoolDetails = getPoolPriceValue({
              balance: { asset, amount },
              poolDetails: pendingPoolDetails,
              pricePool
            })
            price = formatPrice(priceOptionFromPendingPoolDetails, pricePool.asset) || price
          }

          // Special case for Maya assets
          if (price === noDataString && isMayaAsset(asset)) {
            const mayaPrice = calculateMayaValueInUSD(amount, mayaScanPrice)
            if (RD.isSuccess(mayaPrice)) {
              price = formatAssetAmountCurrency({
                amount: mayaPrice.value.assetAmount,
                asset: mayaPrice.value.asset,
                decimal: isUSDAsset(mayaPrice.value.asset) ? 2 : 6,
                trimZeros: !isUSDAsset(mayaPrice.value.asset)
              })
            }
          }
        }

        return (
          <div className="flex flex-col items-end justify-center font-main">
            <div className="text-16 text-text0 dark:text-text0d">{hidePrivateData ? hiddenString : balance}</div>
            <div className="text-14 text-gray2 dark:text-gray2d">{hidePrivateData ? hiddenString : price}</div>
          </div>
        )
      }
    }),
    [hidePrivateData, poolDetailsMaya, mayaPricePool, poolDetails, pricePool, pendingPoolDetails, mayaScanPrice]
  )

  const renderActionColumn = useCallback(
    ({ asset, walletAddress, walletAccount, walletIndex, walletType, hdMode }: WalletBalance) => {
      const walletAsset: SelectedWalletAsset = { asset, walletAddress, walletAccount, walletIndex, walletType, hdMode }
      const normalizedAssetString = assetToString(asset).toUpperCase()
      const hasActivePool: boolean = FP.pipe(
        O.fromNullable(
          dex.chain === THORChain ? poolsData[normalizedAssetString] : poolsDataMaya[normalizedAssetString]
        ),
        O.isSome
      )

      const deepestPoolAsset = FP.pipe(
        getDeepestPool(poolDetails),
        O.chain(({ asset }) => O.fromNullable(assetFromString(asset))),
        O.toNullable
      )
      const hasSaversAssets = FP.pipe(
        poolDetails,
        A.filter(({ saversDepth }) => Number(saversDepth) > 0),
        A.filterMap(({ asset: assetString }) => O.fromNullable(assetFromString(assetString))),
        A.exists(
          (assetPool) =>
            assetPool.chain.toUpperCase() === asset.chain.toUpperCase() &&
            assetPool.symbol.toUpperCase() === asset.symbol.toUpperCase() &&
            assetPool.ticker.toUpperCase() === asset.ticker.toUpperCase()
        )
      )

      const createAction = (labelId: string, callback: () => void) => ({
        label: intl.formatMessage({ id: labelId }),
        callback
      })

      const actions: ActionButtonAction[] = [
        createAction('wallet.action.send', () => assetHandler(walletAsset, 'send'))
      ]

      if (isRuneNativeAsset(asset) && deepestPoolAsset && dex.chain !== MAYAChain) {
        actions.push(
          createAction('common.swap', () =>
            navigate(
              poolsRoutes.swap.path({
                source: assetToString(asset),
                target: assetToString(deepestPoolAsset),
                sourceWalletType: walletType,
                targetWalletType: DEFAULT_WALLET_TYPE
              })
            )
          )
        )
      }

      if (isCacaoAsset(asset) && deepestPoolAsset && dex.chain !== THORChain) {
        actions.push(
          createAction('common.swap', () =>
            navigate(
              poolsRoutes.swap.path({
                source: assetToString(asset),
                target: assetToString(deepestPoolAsset),
                sourceWalletType: walletType,
                targetWalletType: DEFAULT_WALLET_TYPE
              })
            )
          )
        )
      }

      if (isSynthAsset(asset)) {
        actions.push(
          createAction('common.swap', () =>
            navigate(
              poolsRoutes.swap.path({
                source: `${asset.chain}/${asset.symbol}`,
                target: assetToString(dex.asset),
                sourceWalletType: walletType,
                targetWalletType: DEFAULT_WALLET_TYPE
              })
            )
          )
        )
      }

      if (hasActivePool) {
        actions.push(
          createAction('common.swap', () =>
            navigate(
              poolsRoutes.swap.path({
                source: assetToString(asset),
                target: assetToString(
                  isRuneNativeAsset(asset) || dex.chain === MAYAChain ? AssetCacao : AssetRuneNative
                ),
                sourceWalletType: walletType,
                targetWalletType: DEFAULT_WALLET_TYPE
              })
            )
          )
        )

        if (dex.chain !== MAYAChain && hasSaversAssets) {
          actions.push(
            createAction('common.earn', () =>
              navigate(
                poolsRoutes.earn.path({
                  asset: assetToString(asset),
                  walletType: walletType
                })
              )
            )
          )
        }

        if (isRuneNativeAsset(asset) && dex.chain === THORChain && deepestPoolAsset) {
          actions.push(
            createAction('common.add', () =>
              navigate(
                poolsRoutes.deposit.path({
                  asset: assetToString(deepestPoolAsset),
                  assetWalletType: DEFAULT_WALLET_TYPE,
                  runeWalletType: walletType
                })
              )
            )
          )
        }

        if (isCacaoAsset(asset) && dex.chain === MAYAChain && deepestPoolAsset) {
          actions.push(
            createAction('common.add', () =>
              navigate(
                poolsRoutes.deposit.path({
                  asset: assetToString(deepestPoolAsset),
                  assetWalletType: DEFAULT_WALLET_TYPE,
                  runeWalletType: walletType
                })
              )
            )
          )
        }

        actions.push(
          createAction('common.add', () =>
            navigate(
              poolsRoutes.deposit.path({
                asset: assetToString(asset),
                assetWalletType: walletType,
                runeWalletType: DEFAULT_WALLET_TYPE
              })
            )
          )
        )
      }

      if (isRuneNativeAsset(asset) || isCacaoAsset(asset)) {
        actions.push(createAction('wallet.action.deposit', () => assetHandler(walletAsset, 'deposit')))
      }

      return (
        <div className="flex justify-center">
          <ActionButton size="normal" actions={actions} />
        </div>
      )
    },
    [dex, poolsData, poolsDataMaya, poolDetails, intl, navigate, assetHandler]
  )

  const actionColumn: ColumnType<WalletBalance> = useMemo(
    () => ({
      width: 150,
      render: renderActionColumn
    }),
    [renderActionColumn]
  )

  const columns = useMemo(() => {
    if (screenMap?.lg ?? false) {
      return [iconColumn, tickerColumn, balanceColumn, actionColumn]
    }
    if (screenMap?.sm ?? false) {
      return [iconColumn, tickerColumn, balanceColumn, actionColumn]
    }
    if (screenMap?.xs ?? false) {
      return [iconColumn, balanceColumn, actionColumn]
    }
    return []
  }, [actionColumn, balanceColumn, iconColumn, screenMap?.lg, screenMap?.sm, screenMap?.xs, tickerColumn])

  const renderAssetsTable = useCallback(
    ({ tableData, loading = false }: { tableData: WalletBalances; loading?: boolean }) => {
      return (
        <Styled.Table
          showHeader={false}
          dataSource={tableData}
          loading={loading}
          rowKey={({ asset }) => `${asset.chain}.${asset.symbol}`}
          onRow={onRowHandler}
          columns={columns}
        />
      )
    },
    [columns, onRowHandler]
  )

  const renderBalances = useCallback(
    ({ balancesRD, index, chain }: { balancesRD: WalletBalancesRD; index: number; chain: Chain }) => {
      return FP.pipe(
        balancesRD,
        RD.fold(
          () => renderAssetsTable({ tableData: [], loading: false }),
          () => {
            const data = previousAssetsTableData.current[index] ?? []
            return renderAssetsTable({
              tableData: data,
              loading: true
            })
          },
          ({ msg }: ApiError) => {
            return <ErrorView title={msg} />
          },
          (balances) => {
            // Check if balances array is empty
            if (balances.length === 0) {
              // Mock data to show at least one asset with zero baseAmount
              balances = [
                {
                  asset: getChainAsset(chain),
                  amount: ZERO_BASE_AMOUNT,
                  walletAddress: 'mock-address',
                  walletType: 'keystore',
                  walletAccount: 0,
                  walletIndex: 0,
                  hdMode: 'default'
                }
              ]
            }
            let sortedBalances = balances.sort((a, b) => b.amount.amount().minus(a.amount.amount()).toNumber())

            if (filterByValue) {
              sortedBalances = sortedBalances.filter(({ amount, asset }) => {
                if (
                  (isUSDAsset(asset) && asset.type !== AssetType.SYNTH && amount.amount().gt(1)) ||
                  isMayaAsset(asset)
                ) {
                  return true
                }
                let usdValue: O.Option<BaseAmount>
                usdValue =
                  isChainOfMaya(asset.chain) || isCacaoAsset(asset)
                    ? getPoolPriceValueM({ balance: { asset, amount }, poolDetails: poolDetailsMaya, pricePool })
                    : getPoolPriceValue({ balance: { asset, amount }, poolDetails, pricePool })
                usdValue = O.isNone(usdValue)
                  ? getPoolPriceValue({ balance: { asset, amount }, poolDetails, pricePool })
                  : usdValue
                const result = O.isSome(usdValue) && usdValue.value.amount().gt(0)
                return result
              })
            }
            if ((dex.chain === MAYAChain && chain === THORChain) || (dex.chain === THORChain && chain === MAYAChain)) {
              sortedBalances = sortedBalances.filter(({ asset }) => asset.type !== AssetType.SYNTH)
            }
            previousAssetsTableData.current[index] = sortedBalances
            return renderAssetsTable({
              tableData: sortedBalances,
              loading: false
            })
          }
        )
      )
    },
    [dex, filterByValue, poolDetails, poolDetailsMaya, pricePool, renderAssetsTable]
  )

  const renderPanel = useCallback(
    ({ chain, walletType, walletAddress: oWalletAddress, balances: balancesRD }: ChainBalance, key: number) => {
      if (O.isNone(oWalletAddress) && RD.isInitial(balancesRD)) {
        return null
      }

      const walletAddress = FP.pipe(
        oWalletAddress,
        O.getOrElse(() => intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
      )

      const assetsTxt = FP.pipe(
        balancesRD,
        RD.fold(
          () => '',
          () => intl.formatMessage({ id: 'common.loading' }),
          (_: ApiError) => intl.formatMessage({ id: 'common.error' }),
          (balances) => {
            const nonZeroBalances = balances.filter((balance: Balance) => balance.amount.gt(0))
            const length = nonZeroBalances.length
            const i18nKey = length === 1 ? 'common.asset' : 'common.assets'
            return `(${length} ${intl.formatMessage({ id: i18nKey })})`
          }
        )
      )

      const header = (
        <Styled.HeaderRow className="flex w-full justify-between space-x-4">
          <Col flex="0 0 10rem" span={4}>
            <Styled.HeaderChainContainer>
              <Styled.HeaderLabel>{chainToString(chain)}</Styled.HeaderLabel>
              {!isKeystoreWallet(walletType) && (
                <Styled.WalletTypeLabel>{walletTypeToI18n(walletType, intl)}</Styled.WalletTypeLabel>
              )}
            </Styled.HeaderChainContainer>
          </Col>
          <Col flex={1} span={9}>
            <Styled.HeaderAddress>
              {hidePrivateData ? hiddenString : walletAddress}
              <Styled.CopyLabelContainer
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}>
                <Styled.CopyLabel copyable={{ text: walletAddress }} />
              </Styled.CopyLabelContainer>
            </Styled.HeaderAddress>
          </Col>

          <Col flex="0 1 auto" span={3} style={{ textAlign: 'right' }}>
            <Styled.HeaderLabel color={RD.isFailure(balancesRD) ? 'error' : 'gray'}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {isEvmChain(chain) && (
                  // @asgardexTeam Add Locale for tooltip
                  <InfoIcon tooltip={'Token not showing, add contract in wallet settings'} color="primary" />
                )}
                <span style={{ marginLeft: isEvmChain(chain) ? '5px' : '0' }}>{assetsTxt}</span>
              </span>
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
                  handleRefreshClick(chain)
                }}
              />
              <FlatButton
                className="ml-2 pl-2"
                size="small"
                color="neutral"
                onClick={(event) => {
                  event.stopPropagation()
                  setShowQRModal(O.some({ asset: getChainAsset(chain), address: walletAddress }))
                }}>
                <span className="hidden sm:inline-block">{intl.formatMessage({ id: 'wallet.action.receive' })}</span>
              </FlatButton>
            </div>
          </Col>
        </Styled.HeaderRow>
      )

      return (
        <Panel header={header} key={key}>
          {renderBalances({
            balancesRD,
            index: key,
            chain
          })}
        </Panel>
      )
    },
    [disableRefresh, hidePrivateData, intl, renderBalances]
  )

  useEffect(() => {
    if (!collapseChangedByUser) {
      const keys = FP.pipe(
        chainBalances,
        A.map(({ balances }) => balances),
        A.map(RD.getOrElse((): WalletBalances => [])),
        A.filterMapWithIndex((i, balances) =>
          balances.length > 0 || (previousAssetsTableData.current[i] && previousAssetsTableData.current[i].length !== 0)
            ? O.some(i.toString())
            : O.none
        )
      )
      setAllPanelKeys(keys)
    }
  }, [chainBalances, collapseChangedByUser])

  const onChangeCollapseHandler = useCallback((key: string | string[]) => {
    if (Array.isArray(key)) {
      setOpenPanelKeys(key)
    } else {
      setOpenPanelKeys([key])
    }
    setCollapseChangedByUser(true)
  }, [])

  const closeQrModal = useCallback(() => setShowQRModal(O.none), [setShowQRModal])

  const renderQRCodeModal = useMemo(() => {
    return FP.pipe(
      showQRModal,
      O.map(({ asset, address }) => (
        <QRCodeModal
          key="qr-modal"
          asset={asset}
          address={address}
          network={network}
          visible={true}
          onCancel={closeQrModal}
          onOk={closeQrModal}
        />
      )),
      O.getOrElse(() => <></>)
    )
  }, [showQRModal, network, closeQrModal])

  return (
    <>
      <Row className="items-center">
        <Styled.FilterCheckbox checked={filterByValue} onChange={(e) => setFilterByValue(e.target.checked)}>
          {intl.formatMessage({ id: 'common.filterValue' })}
        </Styled.FilterCheckbox>
        <div
          className="rounded-md border border-solid border-turquoise p-1 text-14 text-gray2 dark:border-gray1d dark:text-gray2d"
          onClick={handleCollapseAll}>
          {collapseAll
            ? intl.formatMessage({ id: 'common.collapseAll' })
            : intl.formatMessage({ id: 'common.expandAll' })}
        </div>
        {disabledChains.length > 0 ? (
          <div className="flex items-center text-14 text-gray2 dark:border-gray1d dark:text-gray2d">
            <p className="m-2 ">{intl.formatMessage({ id: 'common.disabledChains' })}</p>
            <div className="flex space-x-2">
              {disabledChains.map((chain) => (
                <span key={chain} className="rounded bg-gray-200 px-2 py-1">
                  {chain}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <></>
        )}
      </Row>

      <Styled.Collapse
        expandIcon={({ isActive }) => <Styled.ExpandIcon rotate={isActive ? 90 : 0} />}
        defaultActiveKey={openPanelKeys}
        activeKey={openPanelKeys}
        expandIconPosition="end"
        onChange={onChangeCollapseHandler}
        ghost>
        {chainBalances.map(renderPanel)}
        {renderQRCodeModal}
      </Styled.Collapse>
    </>
  )
}
