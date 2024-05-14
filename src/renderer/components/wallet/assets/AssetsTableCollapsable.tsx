import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import {
  Address,
  Asset,
  assetFromString,
  assetToString,
  baseAmount,
  baseToAsset,
  Chain,
  CryptoAmount,
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
import { chainToString, isChainOfMaya } from '../../../../shared/utils/chain'
import { isKeystoreWallet } from '../../../../shared/utils/guard'
import { AssetUSDC, DEFAULT_WALLET_TYPE } from '../../../const'
import {
  isAethAsset,
  isCacaoAsset,
  isDashAsset,
  isKujiAsset,
  isMayaAsset,
  isRuneNativeAsset,
  isUSDAsset
} from '../../../helpers/assetHelper'
import { getChainAsset, isArbChain } from '../../../helpers/chainHelper'
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
import { QRCodeModal } from '../../uielements/qrCodeModal/QRCodeModal'
import * as Styled from './AssetsTableCollapsable.styles'

const { Panel } = Collapse

export type AssetAction = 'send' | 'deposit'

type Props = {
  disableRefresh: boolean
  chainBalances: ChainBalances
  pricePool: PricePool
  mayaPricePool: PricePool
  poolDetails: PoolDetails
  poolDetailsMaya: PoolDetailsMaya
  pendingPoolDetails: PoolDetails
  pendingPoolDetailsMaya: PoolDetailsMaya
  poolsData: PoolsDataMap
  poolsDataMaya: PoolsDataMap
  selectAssetHandler: (asset: SelectedWalletAsset) => void
  assetHandler: (asset: SelectedWalletAsset, action: AssetAction) => void
  network: Network
  mimirHalt: MimirHaltRD
  hidePrivateData: boolean
  dex: Dex
  mayaScanPrice: MayaScanPriceRD
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
    mayaScanPrice
  } = props

  const intl = useIntl()
  const navigate = useNavigate()
  const screenMap: ScreenMap = Grid.useBreakpoint()

  const [showQRModal, setShowQRModal] = useState<O.Option<{ asset: Asset; address: Address }>>(O.none)

  const [filterByValue, setFilterByValue] = useState(() => {
    const cachedValue = localStorage.getItem('filterByValue')
    return cachedValue ? JSON.parse(cachedValue) : false
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
    ({ asset, walletAddress, walletType, walletIndex, hdMode }: WalletBalance) => ({
      onClick: () => selectAssetHandler({ asset, walletAddress, walletType, walletIndex, hdMode })
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
        if (isUSDAsset(asset)) {
          price = balance.toString()
        } else if (
          isCacaoAsset(asset) ||
          isDashAsset(asset) ||
          isKujiAsset(asset) ||
          isAethAsset(asset) ||
          isArbChain(asset.chain)
        ) {
          const priceOptionFromPoolDetails = getPoolPriceValueM({
            balance: { asset, amount },
            poolDetails: poolDetailsMaya,
            pricePool: mayaPricePool
          })

          if (O.isSome(priceOptionFromPoolDetails)) {
            price = formatAssetAmountCurrency({
              amount: baseToAsset(priceOptionFromPoolDetails.value),
              asset: mayaPricePool.asset,
              decimal: isUSDAsset(mayaPricePool.asset) ? 2 : 4
            })
          }
        } else {
          const priceOptionFromPoolDetails = getPoolPriceValue({
            balance: { asset, amount },
            poolDetails,
            pricePool
          })
          if (O.isSome(priceOptionFromPoolDetails)) {
            price = formatAssetAmountCurrency({
              amount: baseToAsset(priceOptionFromPoolDetails.value),
              asset: pricePool.asset,
              decimal: isUSDAsset(pricePool.asset) ? 2 : 4
            })
          } else {
            const priceOptionFromPendingPoolDetails = getPoolPriceValue({
              balance: { asset, amount },
              poolDetails: pendingPoolDetails,
              pricePool
            })
            if (O.isSome(priceOptionFromPendingPoolDetails)) {
              price = formatAssetAmountCurrency({
                amount: baseToAsset(priceOptionFromPendingPoolDetails.value),
                asset: pricePool.asset,
                decimal: isUSDAsset(pricePool.asset) ? 2 : 4
              })
            } else {
              price = noDataString
            }
            if (isMayaAsset(asset)) {
              const mayaPrice = calculateMayaValueInUSD(amount, mayaScanPrice)
              price = RD.isSuccess(mayaPrice)
                ? formatAssetAmountCurrency({
                    amount: mayaPrice.value.assetAmount,
                    asset: mayaPrice.value.asset,
                    decimal: isUSDAsset(mayaPrice.value.asset) ? 2 : 6,
                    trimZeros: !isUSDAsset(mayaPrice.value.asset)
                  })
                : noDataString
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
    ({ asset, walletAddress, walletIndex, walletType, hdMode }: WalletBalance) => {
      const walletAsset: SelectedWalletAsset = { asset, walletAddress, walletIndex, walletType, hdMode }
      const normalizedAssetString = assetToString(asset).toUpperCase()
      const hasActivePool: boolean = FP.pipe(
        O.fromNullable(dex === 'THOR' ? poolsData[normalizedAssetString] : poolsDataMaya[normalizedAssetString]),
        O.isSome
      )

      const deepestPoolAsset = FP.pipe(
        getDeepestPool(poolDetails),
        O.chain(({ asset }) => O.fromNullable(assetFromString(asset))),
        O.toNullable
      )

      let actions: ActionButtonAction[] = []

      actions = FP.pipe(
        [
          {
            label: intl.formatMessage({ id: 'wallet.action.send' }),
            callback: () => {
              assetHandler(walletAsset, 'send')
            }
          }
        ],
        A.concatW<ActionButtonAction>(
          isRuneNativeAsset(asset) && deepestPoolAsset !== null && dex !== 'MAYA'
            ? [
                {
                  label: intl.formatMessage({ id: 'common.swap' }),
                  callback: () => {
                    navigate(
                      poolsRoutes.swap.path({
                        source: assetToString(asset),
                        target: assetToString(deepestPoolAsset),
                        sourceWalletType: walletType,
                        targetWalletType: DEFAULT_WALLET_TYPE
                      })
                    )
                  }
                }
              ]
            : []
        ),
        A.concatW<ActionButtonAction>(
          isCacaoAsset(asset) && deepestPoolAsset !== null && dex !== 'THOR'
            ? [
                {
                  label: intl.formatMessage({ id: 'common.swap' }),
                  callback: () => {
                    navigate(
                      poolsRoutes.swap.path({
                        source: assetToString(asset),
                        target: assetToString(deepestPoolAsset),
                        sourceWalletType: walletType,
                        targetWalletType: DEFAULT_WALLET_TYPE
                      })
                    )
                  }
                }
              ]
            : []
        ),
        A.concatW<ActionButtonAction>(
          isSynthAsset(asset)
            ? [
                {
                  label: intl.formatMessage({ id: 'common.swap' }),
                  callback: () => {
                    navigate(
                      poolsRoutes.swap.path({
                        source: `${asset.chain}/${asset.symbol}`,
                        target: assetToString(dex === 'THOR' ? AssetRuneNative : AssetCacao),
                        sourceWalletType: walletType,
                        targetWalletType: DEFAULT_WALLET_TYPE
                      })
                    )
                  }
                }
              ]
            : []
        ),
        A.concatW<ActionButtonAction>(
          hasActivePool
            ? [
                {
                  label: intl.formatMessage({ id: 'common.swap' }),
                  callback: () => {
                    navigate(
                      poolsRoutes.swap.path({
                        source: assetToString(asset),
                        target: assetToString(isRuneNativeAsset(asset) ? AssetCacao : AssetRuneNative),
                        sourceWalletType: walletType,
                        targetWalletType: DEFAULT_WALLET_TYPE
                      })
                    )
                  }
                }
              ]
            : []
        ),
        A.concatW<ActionButtonAction>(
          hasActivePool && dex !== 'MAYA'
            ? [
                {
                  label: intl.formatMessage({ id: 'common.earn' }),
                  callback: () => {
                    navigate(
                      poolsRoutes.earn.path({
                        asset: assetToString(asset),
                        walletType: walletType
                      })
                    )
                  }
                }
              ]
            : []
        ),
        A.concatW<ActionButtonAction>(
          dex === 'THOR' && isRuneNativeAsset(asset) && deepestPoolAsset !== null
            ? [
                {
                  label: intl.formatMessage({ id: 'common.add' }),
                  callback: () => {
                    navigate(
                      poolsRoutes.deposit.path({
                        asset: assetToString(deepestPoolAsset),
                        assetWalletType: DEFAULT_WALLET_TYPE,
                        runeWalletType: walletType
                      })
                    )
                  }
                }
              ]
            : []
        ),
        A.concatW<ActionButtonAction>(
          dex === 'MAYA' && isCacaoAsset(asset) && deepestPoolAsset !== null
            ? [
                {
                  label: intl.formatMessage({ id: 'common.add' }),
                  callback: () => {
                    navigate(
                      poolsRoutes.deposit.path({
                        asset: assetToString(deepestPoolAsset),
                        assetWalletType: DEFAULT_WALLET_TYPE,
                        runeWalletType: walletType
                      })
                    )
                  }
                }
              ]
            : []
        ),
        A.concatW<ActionButtonAction>(
          hasActivePool
            ? [
                {
                  label: intl.formatMessage({ id: 'common.add' }),
                  callback: () => {
                    navigate(
                      poolsRoutes.deposit.path({
                        asset: assetToString(asset),
                        assetWalletType: walletType,
                        runeWalletType: DEFAULT_WALLET_TYPE
                      })
                    )
                  }
                }
              ]
            : []
        ),
        A.concatW<ActionButtonAction>(
          isRuneNativeAsset(asset) || isCacaoAsset(asset)
            ? [
                {
                  label: intl.formatMessage({ id: 'wallet.action.deposit' }),
                  callback: () => {
                    assetHandler(walletAsset, 'deposit')
                  }
                }
              ]
            : []
        )
      )

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
            let sortedBalances = balances.sort((a, b) => b.amount.amount().minus(a.amount.amount()).toNumber())

            if (filterByValue) {
              sortedBalances = sortedBalances.filter(({ amount, asset }) => {
                if ((isUSDAsset(asset) && !asset.synth && amount.amount().gt(1)) || isMayaAsset(asset)) {
                  return true
                }
                const usdValue =
                  isChainOfMaya(asset.chain) || isCacaoAsset(asset)
                    ? getPoolPriceValueM({ balance: { asset, amount }, poolDetails: poolDetailsMaya, pricePool })
                    : getPoolPriceValue({ balance: { asset, amount }, poolDetails, pricePool })

                return (
                  O.isSome(usdValue) &&
                  new CryptoAmount(baseAmount(usdValue.value.amount()), AssetUSDC).assetAmount.gt(1)
                )
              })
            }
            if ((dex === 'MAYA' && chain === 'THOR') || (dex === 'THOR' && chain === 'MAYA')) {
              sortedBalances = sortedBalances.filter(({ asset }) => !asset.synth)
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
            const length = balances.length
            const i18nKey = length <= 1 ? 'common.asset' : 'common.assets'
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
              {`${assetsTxt}`}
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
