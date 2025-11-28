import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { ColumnDef } from '@tanstack/react-table'
import { Balance, Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { isTCYAsset, THORChain } from '@xchainjs/xchain-thorchain'
import {
  Address,
  AnyAsset,
  Asset,
  assetFromString,
  assetToString,
  BaseAmount,
  baseToAsset,
  Chain,
  formatAssetAmountCurrency,
  isSecuredAsset,
  isSynthAsset
} from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router'

import { chainToString, EnabledChain, isChainOfMaya, isChainOfThor } from '../../../../shared/utils/chain'
import { isKeystoreWallet } from '../../../../shared/utils/guard'
import { WalletType } from '../../../../shared/wallet/types'
import { DEFAULT_WALLET_TYPE, ZERO_BASE_AMOUNT } from '../../../const'
import { useWalletContext } from '../../../contexts/WalletContext'
import { truncateAddress } from '../../../helpers/addressHelper'
import {
  isBtcAsset,
  isBtcSecuredAsset,
  isCacaoAsset,
  isMayaAsset,
  isRuneNativeAsset,
  isUSDAsset
} from '../../../helpers/assetHelper'
import { getChainAsset } from '../../../helpers/chainHelper'
import { isEvmChain } from '../../../helpers/evmHelper'
import { getDeepestPool, getPoolPriceValue, getSecondDeepestPool } from '../../../helpers/poolHelper'
import { getPoolPriceValue as getPoolPriceValueM } from '../../../helpers/poolHelperMaya'
import { hiddenString, noDataString } from '../../../helpers/stringHelper'
import { useBreakpoint } from '../../../hooks/useBreakpoint'
import { calculateMayaValueInUSD, MayaScanPriceRD } from '../../../hooks/useMayascanPrice'
import * as poolsRoutes from '../../../routes/pools'
import { WalletBalancesRD } from '../../../services/clients'
import { PoolDetails as PoolDetailsMaya } from '../../../services/midgard/mayaMidgard/types'
import { PoolDetails, PoolsDataMap, PricePool } from '../../../services/midgard/midgardTypes'
import { MimirHaltRD } from '../../../services/thorchain/types'
import { reloadBalancesByChain } from '../../../services/wallet'
import {
  ApiError,
  ChainBalance,
  ChainBalances,
  isStandaloneLedgerMode,
  SelectedWalletAsset,
  WalletBalance,
  WalletBalances
} from '../../../services/wallet/types'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { useApp } from '../../../store/app/hooks'
import { FixmeType } from '../../../types/asgardex'
import { GECKO_MAP } from '../../../types/generated/geckoMap'
import { ErrorView } from '../../shared/error/'
import { Table } from '../../table'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { ChainIcon } from '../../uielements/assets/chainIcon/ChainIcon'
import { Action as ActionButtonAction, ActionButton } from '../../uielements/button/ActionButton'
import { IconButton } from '../../uielements/button/IconButton'
import { Collapse } from '../../uielements/collapse'
import { WalletTypeLabel, AssetSynthLabel, AssetSecuredLabel } from '../../uielements/common'
import { InfoIcon } from '../../uielements/info'
import { CopyLabel, Label } from '../../uielements/label'
import { QRCodeModal } from '../../uielements/qrCodeModal/QRCodeModal'

export type AssetAction = 'send' | 'deposit'

type GetPoolPriceValueFnThor = (params: {
  balance: Balance
  poolDetails: PoolDetails
  pricePool: PricePool
}) => O.Option<BaseAmount>

type GetPoolPriceValueFnMaya = (params: {
  balance: Balance
  poolDetails: PoolDetailsMaya
  pricePool: PricePool
  mayaPriceRD: MayaScanPriceRD
}) => O.Option<BaseAmount>

type Props = {
  disableRefresh: boolean
  chainBalances: ChainBalances
  geckoPrice: Record<string, { usd: number }>
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
  mayaScanPrice: MayaScanPriceRD
  disabledChains: EnabledChain[]
}

export const AssetsTableCollapsable = (props: Props): JSX.Element => {
  const {
    disableRefresh,
    chainBalances = [],
    geckoPrice: geckoPriceData,
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
    mayaScanPrice,
    disabledChains
  } = props

  const { setProtocol } = useApp()
  const intl = useIntl()
  const navigate = useNavigate()
  const isXLargeView = useBreakpoint()?.xl ?? false

  // Get app wallet state to check for standalone ledger mode
  const { appWalletService } = useWalletContext()
  const appWalletState = useObservableState(appWalletService.appWalletState$)
  const isStandaloneLedger = appWalletState && isStandaloneLedgerMode(appWalletState)

  const [showQRModal, setShowQRModal] = useState<O.Option<{ asset: Asset; address: Address }>>(O.none)

  const [openPanelKeys, setOpenPanelKeys] = useState<number[]>(() => {
    const cachedKeys = localStorage.getItem('openPanelKeys')
    try {
      return cachedKeys ? JSON.parse(cachedKeys).map((item: string) => parseInt(item)) : []
    } catch (error) {
      console.error('Failed to parse openPanelKeys from localStorage:', error)
      return []
    }
  })

  const [collapseAll, setCollapseAll] = useState<boolean>(false)

  useEffect(() => {
    if (openPanelKeys.length === 0) setCollapseAll(true)
    if (openPanelKeys.length === chainBalances.length) setCollapseAll(false)

    localStorage.setItem('openPanelKeys', JSON.stringify(openPanelKeys))
  }, [openPanelKeys, chainBalances.length])

  const handleRefreshClick = (chain: Chain, walletType: WalletType) => {
    const lazyReload = reloadBalancesByChain(chain, walletType)
    lazyReload()
  }

  // store previous data of asset data to render these while reloading
  const previousAssetsTableData = useRef<WalletBalances[]>([])

  const toggleOne = useCallback((key: number) => {
    setOpenPanelKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }, [])

  const handleCollapseAll = useCallback(() => {
    if (collapseAll) {
      const keys = Array.from({ length: chainBalances.length }, (_, i) => i)
      setOpenPanelKeys(keys)
      localStorage.setItem('openPanelKeys', JSON.stringify(keys))
    } else {
      setOpenPanelKeys([])
      localStorage.setItem('openPanelKeys', JSON.stringify([]))
    }
    setCollapseAll((prev) => !prev)
  }, [chainBalances.length, collapseAll])

  const getBalance = useCallback(
    ({ asset, amount }: WalletBalance) => {
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
        pricePool: PricePool,
        mayaPriceRD: MayaScanPriceRD
      ) => {
        const priceOption = getPoolPriceValueFn({
          balance: { asset, amount },
          poolDetails,
          pricePool,
          mayaPriceRD
        })
        return formatPrice(priceOption, pricePool.asset)
      }

      // USD Asset case
      if (isUSDAsset(asset)) {
        price = balance.toString()
      } else {
        const geckoPrice = geckoPriceData[GECKO_MAP?.[asset.symbol.toUpperCase()]]?.usd
        const isThorchainNonEmpty = poolDetails.length !== 0
        const isMayachainNonEmpty = poolDetailsMaya.length !== 0

        if (isChainOfMaya(asset.chain) && isChainOfThor(asset.chain)) {
          // Chain is supported by both MAYA and THOR, prioritize THOR
          price =
            (isThorchainNonEmpty && getPriceThor(getPoolPriceValue, poolDetails as PoolDetails, pricePool)) ||
            (isMayachainNonEmpty &&
              getPriceMaya(getPoolPriceValueM, poolDetailsMaya as PoolDetailsMaya, mayaPricePool, mayaScanPrice)) ||
            (geckoPrice && formatPrice(O.some(amount.times(geckoPrice)), pricePool.asset)) ||
            price
        } else if (isChainOfMaya(asset.chain)) {
          // Chain is supported only by MAYA
          price =
            (isMayachainNonEmpty &&
              getPriceMaya(getPoolPriceValueM, poolDetailsMaya as PoolDetailsMaya, mayaPricePool, mayaScanPrice)) ||
            (geckoPrice && formatPrice(O.some(amount.times(geckoPrice)), pricePool.asset)) ||
            price
        } else if (isChainOfThor(asset.chain)) {
          // Chain is supported only by THOR
          price =
            (isThorchainNonEmpty && getPriceThor(getPoolPriceValue, poolDetails as PoolDetails, pricePool)) ||
            (geckoPrice && formatPrice(O.some(amount.times(geckoPrice)), pricePool.asset)) ||
            price
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
      return {
        balance,
        price
      }
    },
    [geckoPriceData, mayaPricePool, mayaScanPrice, pendingPoolDetails, poolDetails, poolDetailsMaya, pricePool]
  )

  const onRowHandler = useCallback(
    (walletBalance: WalletBalance) => {
      const { price } = getBalance(walletBalance)
      const { asset, walletAccount, walletAddress, walletIndex, walletType, hdMode } = walletBalance

      selectAssetHandler({ asset, walletAccount, walletAddress, walletIndex, walletType, hdMode, price })
    },
    [getBalance, selectAssetHandler]
  )

  const renderActionColumn = useCallback(
    ({ asset, walletAddress, walletAccount, walletIndex, walletType, hdMode }: WalletBalance) => {
      const walletAsset: SelectedWalletAsset = { asset, walletAddress, walletAccount, walletIndex, walletType, hdMode }
      const normalizedAssetString = assetToString(asset).toUpperCase()
      const hasActivePool: boolean = FP.pipe(
        O.fromNullable(poolsData[normalizedAssetString]),
        O.alt(() => O.fromNullable(poolsDataMaya[normalizedAssetString])),
        O.isSome
      )

      const deepestPoolAsset = FP.pipe(
        getDeepestPool(poolDetails),
        O.chain(({ asset }) => O.fromNullable(assetFromString(asset))),
        O.toNullable
      )

      const secondDeepestPoolAsset = FP.pipe(
        getSecondDeepestPool(poolDetails),
        O.chain(({ asset }) => O.fromNullable(assetFromString(asset))),
        O.toNullable
      )

      const createAction = (labelId: string, callback: () => void) => ({
        label: intl.formatMessage({ id: labelId }),
        callback
      })

      const actions: ActionButtonAction[] = [
        createAction('wallet.action.send', () => assetHandler(walletAsset, 'send'))
      ]

      if (isRuneNativeAsset(asset) && deepestPoolAsset) {
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
      if (isRuneNativeAsset(asset) && deepestPoolAsset && !isStandaloneLedger) {
        actions.push(
          createAction('common.trade', () => {
            setProtocol(THORChain)
            navigate(
              poolsRoutes.swap.path({
                source: assetToString(asset),
                target: `${deepestPoolAsset.chain}~${deepestPoolAsset.symbol}`,
                sourceWalletType: walletType,
                targetWalletType: DEFAULT_WALLET_TYPE
              })
            )
          })
        )
      }

      if (isCacaoAsset(asset) && deepestPoolAsset) {
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
      if (isCacaoAsset(asset) && deepestPoolAsset && !isStandaloneLedger) {
        actions.push(
          createAction('common.trade', () => {
            setProtocol(MAYAChain)
            navigate(
              poolsRoutes.swap.path({
                source: assetToString(asset),
                target: `${deepestPoolAsset.chain}~${deepestPoolAsset.symbol}`,
                sourceWalletType: walletType,
                targetWalletType: DEFAULT_WALLET_TYPE
              })
            )
          })
        )
      }

      if (isSynthAsset(asset) && deepestPoolAsset) {
        actions.push(
          createAction('common.swap', () =>
            navigate(
              poolsRoutes.swap.path({
                source: `${asset.chain}/${asset.symbol}`,
                target: assetToString(AssetCacao),
                sourceWalletType: walletType,
                targetWalletType: DEFAULT_WALLET_TYPE
              })
            )
          )
        )
      }

      if (
        !isSynthAsset(asset) &&
        deepestPoolAsset &&
        secondDeepestPoolAsset &&
        !isCacaoAsset(asset) &&
        !isRuneNativeAsset(asset) &&
        !isSecuredAsset(asset)
      ) {
        actions.push(
          createAction('common.swap', () =>
            navigate(
              poolsRoutes.swap.path({
                source: assetToString(asset),
                target: assetToString(isBtcAsset(asset) ? secondDeepestPoolAsset : deepestPoolAsset),
                sourceWalletType: walletType,
                targetWalletType: DEFAULT_WALLET_TYPE
              })
            )
          )
        )
      }
      if (isSecuredAsset(asset)) {
        actions.push(
          createAction('common.swap', () =>
            navigate(
              poolsRoutes.swap.path({
                source: assetToString(asset),
                target: isBtcSecuredAsset(asset)
                  ? `${secondDeepestPoolAsset?.chain}-${secondDeepestPoolAsset?.symbol}`
                  : `${deepestPoolAsset?.chain}-${deepestPoolAsset?.symbol}`,
                sourceWalletType: walletType,
                targetWalletType: DEFAULT_WALLET_TYPE
              })
            )
          )
        )
      }

      if (hasActivePool && !isStandaloneLedger) {
        actions.push(
          createAction('common.add', () => {
            setProtocol(isChainOfThor(asset.chain) && !isRuneNativeAsset(asset) ? THORChain : MAYAChain)
            navigate(
              poolsRoutes.deposit.path({
                asset: assetToString(asset),
                assetWalletType: walletType,
                dexWalletType: DEFAULT_WALLET_TYPE
              })
            )
          })
        )
      }

      if ((isRuneNativeAsset(asset) || isCacaoAsset(asset) || isTCYAsset(asset)) && !isStandaloneLedger) {
        actions.push(createAction('wallet.action.deposit', () => assetHandler(walletAsset, 'deposit')))
      }

      return (
        <div className="flex justify-center">
          <ActionButton size="normal" actions={actions} />
        </div>
      )
    },
    [poolsData, poolDetails, poolsDataMaya, intl, assetHandler, navigate, setProtocol, isStandaloneLedger]
  )

  const columns: ColumnDef<WalletBalance, FixmeType>[] = useMemo(
    () => [
      {
        accessorKey: 'asset',
        header: intl.formatMessage({ id: 'common.pool' }),
        cell: ({ row }) => {
          const { asset } = row.original
          return (
            <div className="flex items-center space-x-4 pl-4">
              <AssetIcon asset={asset} size="normal" network={network} />
              <div className="flex flex-col">
                <Label className="!text-16 !leading-[18px]" textTransform="uppercase" weight="bold">
                  {asset.ticker}
                </Label>
                {!isSynthAsset(asset) && !isSecuredAsset(asset) && (
                  <Label color="input" textTransform="uppercase" weight="bold">
                    {asset.chain}
                  </Label>
                )}
                {isSynthAsset(asset) && (
                  <AssetSynthLabel className="mt-0.5 px-1 text-[10px] leading-[12px]">synth</AssetSynthLabel>
                )}
                {isSecuredAsset(asset) && (
                  <AssetSecuredLabel className="mt-0.5 px-1 text-[10px] leading-[12px]">secured</AssetSecuredLabel>
                )}
              </div>
            </div>
          )
        }
      },
      {
        accessorKey: 'balance',
        header: '',
        cell: ({ row }) => {
          const { balance, price } = getBalance(row.original)

          return (
            <div className="flex flex-col items-end justify-center font-main">
              <div className="text-16 text-text0 dark:text-text0d">{hidePrivateData ? hiddenString : balance}</div>
              <div className="text-14 text-gray2 dark:text-gray2d">{hidePrivateData ? hiddenString : price}</div>
            </div>
          )
        }
      },
      {
        accessorKey: 'action',
        header: '',
        cell: ({ row }) => renderActionColumn(row.original),
        size: isXLargeView ? 150 : 250
      }
    ],
    [getBalance, hidePrivateData, intl, isXLargeView, network, renderActionColumn]
  )

  const renderAssetsTable = useCallback(
    ({ tableData, loading = false }: { tableData: WalletBalances; loading?: boolean }) => {
      return (
        <Table
          columns={columns}
          data={tableData}
          hideHeader
          hideVerticalBorder
          loading={loading}
          onClickRow={onRowHandler}
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
            return <ErrorView className="rounded-none border-t border-gray0/40 dark:border-gray0d/40" title={msg} />
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
                  walletType: WalletType.Keystore,
                  walletAccount: 0,
                  walletIndex: 0,
                  hdMode: 'default'
                }
              ]
            }

            const sortedBalances = balances.sort((a, b) => b.amount.amount().minus(a.amount.amount()).toNumber())
            previousAssetsTableData.current[index] = sortedBalances
            return renderAssetsTable({
              tableData: sortedBalances,
              loading: false
            })
          }
        )
      )
    },
    [renderAssetsTable]
  )

  const renderHeader = useCallback(
    ({ chain, walletType, walletAddress: oWalletAddress, balances: balancesRD }: ChainBalance, isOpen: boolean) => {
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
      return (
        <div className="flex w-full justify-between space-x-4 bg-bg0 py-1 dark:bg-bg0d">
          <div className="flex flex-row items-center space-x-2">
            {!isOpen && <ChainIcon chain={chain} />}
            <Label className="!w-auto" textTransform="uppercase">
              {chainToString(chain)}
            </Label>
            {!isKeystoreWallet(walletType) && (
              <WalletTypeLabel className="border border-solid border-gray0 bg-bg2 dark:border-gray0d dark:bg-bg2d">
                {walletTypeToI18n(walletType, intl)}
              </WalletTypeLabel>
            )}
            <Label
              className="flex !w-auto items-center space-x-2"
              color={RD.isFailure(balancesRD) ? 'error' : 'gray'}
              textTransform="uppercase">
              <span>{assetsTxt}</span>
              {isEvmChain(chain) && (
                <InfoIcon tooltip={intl.formatMessage({ id: 'wallet.evmToken.tooltip' })} color="primary" />
              )}
            </Label>
          </div>
          <div className="flex items-center justify-end space-x-2">
            <Label className="flex items-center text-text0 dark:text-text0d" color="gray" textTransform="none">
              {hidePrivateData ? hiddenString : truncateAddress(walletAddress, chain, network)}
            </Label>
            <div className="flex items-center justify-end space-x-2 pr-4">
              <IconButton
                onClick={(e) => {
                  e.stopPropagation()
                }}>
                <CopyLabel iconClassName="!text-text2 dark:!text-text2d" textToCopy={walletAddress} />
              </IconButton>
              <IconButton
                disabled={disableRefresh}
                onClick={(e) => {
                  e.stopPropagation()
                  handleRefreshClick(chain, walletType)
                }}>
                <ArrowPathIcon className="ease h-5 w-5 text-text0 group-hover:rotate-180 dark:text-text0d" />
              </IconButton>
              <IconButton
                onClick={(e) => {
                  e.stopPropagation()
                  setShowQRModal(O.some({ asset: getChainAsset(chain), address: walletAddress }))
                }}>
                <QrCodeIcon className="ease h-5 w-5 text-text0 group-hover:rotate-180 dark:text-text0d" />
              </IconButton>
            </div>
          </div>
        </div>
      )
    },
    [disableRefresh, hidePrivateData, intl, network]
  )

  const renderPanel = useCallback(
    ({ chain, walletAddress: oWalletAddress, balances: balancesRD }: ChainBalance, key: number) => {
      if (O.isNone(oWalletAddress) && RD.isInitial(balancesRD)) {
        return null
      }

      return renderBalances({
        balancesRD,
        index: key,
        chain
      })
    },
    [renderBalances]
  )

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
      <div className="flex w-full items-center justify-between space-x-2">
        <div
          className="my-2 cursor-pointer rounded-md border border-solid border-turquoise bg-bg0 px-2 py-1 text-14 text-text2 dark:border-gray1d dark:bg-bg0d dark:text-text2d"
          onClick={handleCollapseAll}>
          {openPanelKeys.length === 0
            ? intl.formatMessage({ id: 'common.expandAll' })
            : intl.formatMessage({ id: 'common.collapseAll' })}
        </div>
        {disabledChains.length > 0 ? (
          <div className="flex items-center text-14 text-text2 dark:border-gray1d dark:text-text2d">
            <p className="m-2 text-warning0 dark:text-warning0d">
              {intl.formatMessage({ id: 'common.disabledChains' })}
            </p>
            <div className="flex space-x-2">
              {disabledChains.map((chain) => (
                <span key={chain} className="rounded bg-gray-200 px-2 py-1 dark:bg-gray0d">
                  {chain}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <></>
        )}
      </div>

      <div className="space-y-2">
        {chainBalances.map((chainBalance, index) => {
          const isOpen = openPanelKeys.includes(index)

          return (
            <Collapse
              key={`${chainBalance.chain}${index}${isOpen}`}
              className="bg-bg0 dark:bg-bg0d"
              header={renderHeader(chainBalance, isOpen)}
              isOpen={isOpen}
              onToggle={() => toggleOne(index)}>
              {renderPanel(chainBalance, index)}
              {renderQRCodeModal}
            </Collapse>
          )
        })}
      </div>
    </>
  )
}
