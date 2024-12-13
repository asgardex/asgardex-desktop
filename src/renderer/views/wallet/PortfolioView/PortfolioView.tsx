import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Squares2X2Icon, ChartPieIcon } from '@heroicons/react/24/outline'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import {
  assetAmount,
  assetFromStringEx,
  assetToBase,
  baseAmount,
  BaseAmount,
  baseToAsset,
  Chain,
  CryptoAmount,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { EnabledChain } from '../../../../shared/utils/chain'
import { RefreshButton } from '../../../components/uielements/button'
import { PieChart } from '../../../components/uielements/charts'
import { ProtocolSwitch } from '../../../components/uielements/protocolSwitch'
import { RadioGroup } from '../../../components/uielements/radioGroup'
import { AssetUSDC, DEFAULT_WALLET_TYPE } from '../../../const'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { isUSDAsset } from '../../../helpers/assetHelper'
import { sequenceTRD } from '../../../helpers/fpHelpers'
import { getCurrencyFormat } from '../../../helpers/numberHelper'
import { RUNE_PRICE_POOL } from '../../../helpers/poolHelper'
import { MAYA_PRICE_POOL } from '../../../helpers/poolHelperMaya'
import { hiddenString } from '../../../helpers/stringHelper'
import { filterWalletBalancesByAssets } from '../../../helpers/walletHelper'
import { useRunePoolProviders } from '../../../hooks/useAllRunePoolProviders'
import { useAllSaverProviders } from '../../../hooks/useAllSaverProviders'
import { useNodeInfos } from '../../../hooks/useNodeInfos'
import { usePoolShares } from '../../../hooks/usePoolShares'
import { useTotalWalletBalance } from '../../../hooks/useWalletBalance'
import * as walletRoutes from '../../../routes/wallet'
import { addressByChain$ } from '../../../services/chain'
import { WalletBalances } from '../../../services/clients'
import { getNodeInfos$ as getNodeInfosMaya$ } from '../../../services/mayachain'
import { NodeInfo as NodeInfoMaya } from '../../../services/mayachain/types'
import { userChains$ } from '../../../services/storage/userChains'
import { userNodes$ } from '../../../services/storage/userNodes'
import { getNodeInfos$, getRunePoolProvider$ } from '../../../services/thorchain'
import { NodeInfo, RunePoolProvider, RunePoolProviderRD } from '../../../services/thorchain/types'
import { balancesState$, getLedgerAddress$, reloadBalancesByChain } from '../../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { useApp } from '../../../store/app/hooks'
import { BaseAmountRD } from '../../../types'
import { getValueOfRuneInAsset } from '../../pools/Pools.utils'
import { WalletAddressInfo } from '../BondsView'
import * as H from '../PoolShareView.helper'
import { getSaversTotal } from '../SaversTableView.helper'
import * as Styled from './PortfolioView.style'
import { PortfolioTabKey } from './utils'

const options = [
  { label: <ChartPieIcon className="h-6 w-6 text-text2 dark:text-text2d" />, value: PortfolioTabKey.ChartView },
  { label: <Squares2X2Icon className="h-6 w-6 text-text2 dark:text-text2d" />, value: PortfolioTabKey.CardView }
]

const CardItem = ({ title, value, route }: { title: string; value: React.ReactNode; route: string }) => {
  const navigate = useNavigate()

  const handleManage = useCallback(() => {
    navigate(route)
  }, [route, navigate])

  return (
    <div className="rounded-lg border border-l-4 border-solid border-gray0 !border-l-turquoise py-2 px-4 dark:border-gray0d">
      <div className="flex w-full items-center justify-between">
        <div className="text-[13px] text-gray2 dark:text-gray2d">{title}</div>
        <div className="cursor-pointer text-[13px] text-turquoise" onClick={handleManage}>
          Manage
        </div>
      </div>
      <div className="text-[20px] text-text2 dark:text-text2d">{value}</div>
    </div>
  )
}

export const PortfolioView: React.FC = (): JSX.Element => {
  const [activeIndex, setActiveIndex] = useState(PortfolioTabKey.ChartView)
  const [protocol, setProtocol] = useState<Chain>(THORChain)

  const { isPrivate } = useApp()
  const intl = useIntl()
  const [balancesState] = useObservableState(
    () =>
      balancesState$({
        ...DEFAULT_BALANCES_FILTER
      }),
    INITIAL_BALANCES_STATE
  )

  const combinedBalances$ = useTotalWalletBalance()

  const [enabledChains, setEnabledChains] = useState<Set<EnabledChain>>(new Set())

  const {
    service: {
      pools: { allPoolDetails$: allPoolDetailsThor$, poolsState$, selectedPricePool$: selectedPricePoolThor$ }
    }
  } = useMidgardContext()

  const {
    service: {
      pools: { allPoolDetails$: allPoolDetailsMaya$, selectedPricePool$: selectedPricePoolMaya$ }
    }
  } = useMidgardMayaContext()

  const poolsStateRD = useObservableState(poolsState$, RD.initial)

  // State for selected price pools
  const [selectedPricePoolThor] = useObservableState(() => selectedPricePoolThor$, RUNE_PRICE_POOL)
  const [selectedPricePoolMaya] = useObservableState(() => selectedPricePoolMaya$, MAYA_PRICE_POOL)

  // Separate price pool data states for each chain
  const { poolData: pricePoolDataThor } = useObservableState(selectedPricePoolThor$, RUNE_PRICE_POOL)
  const { poolData: pricePoolDataMaya } = useObservableState(selectedPricePoolMaya$, MAYA_PRICE_POOL)
  const allPoolDetails$ = protocol === THORChain ? allPoolDetailsThor$ : allPoolDetailsMaya$
  const poolDetailsRD = useObservableState(allPoolDetails$, RD.pending)
  const poolDetailsThorRD = useObservableState(allPoolDetailsThor$, RD.pending)

  useEffect(() => {
    const subscription = userChains$.subscribe((chains: EnabledChain[]) => {
      setEnabledChains(new Set(chains))
    })

    return () => subscription.unsubscribe()
  }, [])

  const [{ balancesByChain }] = useObservableState(() => combinedBalances$, {
    chainBalances: [],
    balancesByChain: {},
    errorsByChain: {}
  })

  const poolSavers = useMemo(
    () =>
      FP.pipe(
        sequenceTRD(poolsStateRD),
        RD.fold(
          () => null,
          () => null,
          (error) => {
            console.error('An error occurred:', error)
            return null
          },
          ([poolsState]) => {
            const poolDetailsFiltered: PoolDetails = FP.pipe(
              poolsState.poolDetails,
              A.filter(({ saversDepth }) => Number(saversDepth) > 0)
            )
            return poolDetailsFiltered // replace this with what you actually want to return
          }
        )
      ),
    [poolsStateRD]
  )
  const poolAsset = useMemo(() => {
    return poolSavers ? poolSavers.map((detail) => assetFromStringEx(detail.asset)) : []
  }, [poolSavers])

  const { balances: oWalletBalances } = balancesState
  const allBalances: WalletBalances = useMemo(() => {
    return FP.pipe(
      oWalletBalances,
      O.map((balances) => filterWalletBalancesByAssets(balances, [AssetRuneNative, AssetCacao])),
      O.getOrElse<WalletBalances>(() => [])
    )
  }, [oWalletBalances])

  // State to track fetched wallet addresses
  const [walletAddresses, setWalletAddresses] = useState<Record<'THOR' | 'MAYA', WalletAddressInfo[]>>({
    THOR: [],
    MAYA: []
  })

  // State to track if wallet addresses have been fetched
  const [addressesFetched, setAddressesFetched] = useState(false)

  // Effect to fetch wallet addresses first
  useEffect(() => {
    const addressesByChain: Record<'THOR' | 'MAYA', WalletAddressInfo[]> = {
      THOR: [],
      MAYA: []
    }

    if (allBalances.length > 0) {
      allBalances.forEach(({ asset, walletAddress, walletType }) => {
        if (asset.chain === 'THOR' || asset.chain === 'MAYA') {
          addressesByChain[asset.chain].push({ address: walletAddress, walletType })
        }
      })

      setWalletAddresses(addressesByChain)
      setAddressesFetched(true)
    } else {
      setAddressesFetched(true)
    }
  }, [allBalances])

  // // Use `useNodeInfos` to manage `nodeInfos` state and observable
  const nodeInfos = useNodeInfos({
    addressesFetched,
    walletAddresses,
    userNodes$,
    getNodeInfos$,
    getNodeInfosMaya$
  })

  const renderBondTotal = useMemo(() => {
    const calculateTotalBondByChain = (nodes: NodeInfo[] | NodeInfoMaya[]) => {
      const walletAddressSet = new Set([
        ...walletAddresses.THOR.map((info) => info.address.toLowerCase()),
        ...walletAddresses.MAYA.map((info) => info.address.toLowerCase())
      ])

      return nodes.reduce(
        (acc, node) => {
          const chain = node.address.startsWith('thor') ? 'THOR' : 'MAYA'

          // Calculate only the total bond provider amount without adding the node's own bond
          const totalBondProviderAmount = node.bondProviders.providers.reduce((providerSum, provider) => {
            const normalizedAddress = provider.bondAddress.toLowerCase()
            if (walletAddressSet.has(normalizedAddress)) {
              return providerSum.plus(provider.bond) // Sum only bondProvider's bondAmount
            }
            return providerSum
          }, assetToBase(assetAmount(0)))

          // Set the bond provider amount total in the accumulator for each chain
          acc[chain] = acc[chain] ? acc[chain].plus(totalBondProviderAmount) : totalBondProviderAmount
          return acc
        },
        { THOR: assetToBase(assetAmount(0)), MAYA: assetToBase(assetAmount(0)) }
      )
    }

    // Use RD.fold to render based on the nodeInfos state
    return FP.pipe(
      nodeInfos,
      RD.fold(
        // Initial loading state
        () => '',

        // Pending state
        () => '',

        // Error state
        (error) => intl.formatMessage({ id: 'common.error.api.limit' }, { errorMsg: error.message }),

        // Success state
        (nodes) => {
          const totals = calculateTotalBondByChain(nodes)

          // Format THOR and MAYA amounts as strings
          const thorTotal = totals.THOR.amount().isGreaterThan(0)
            ? `${
                isPrivate
                  ? hiddenString
                  : formatAssetAmountCurrency({
                      amount: baseToAsset(getValueOfRuneInAsset(totals.THOR, pricePoolDataThor)),
                      asset: selectedPricePoolThor.asset,
                      decimal: isUSDAsset(selectedPricePoolThor.asset) ? 2 : 4
                    })
              }`
            : '$ 0.00'

          const mayaTotal = totals.MAYA.amount().isGreaterThan(0)
            ? `${
                isPrivate
                  ? hiddenString
                  : formatAssetAmountCurrency({
                      amount: baseToAsset(getValueOfRuneInAsset(totals.MAYA, pricePoolDataMaya)),
                      asset: selectedPricePoolMaya.asset,
                      decimal: isUSDAsset(selectedPricePoolMaya.asset) ? 2 : 4
                    })
              }`
            : ''

          // Concatenate the strings for THOR and MAYA, separated by a newline if both are present
          return [thorTotal, mayaTotal].filter(Boolean).join('\n')
        }
      )
    )
  }, [
    intl,
    isPrivate,
    nodeInfos,
    pricePoolDataMaya,
    pricePoolDataThor,
    selectedPricePoolMaya.asset,
    selectedPricePoolThor.asset,
    walletAddresses.MAYA,
    walletAddresses.THOR
  ])

  const { allSharesRD } = usePoolShares(protocol)
  const { allSaverProviders } = useAllSaverProviders(poolAsset)

  const renderSharesTotal = useMemo((): string => {
    const sharesTotalRD: BaseAmountRD = FP.pipe(
      RD.combine(allSharesRD, poolDetailsRD),
      RD.map(([poolShares, poolDetails]) =>
        H.getSharesTotal(
          poolShares,
          poolDetails,
          protocol === THORChain ? pricePoolDataThor : pricePoolDataMaya,
          protocol
        )
      )
    )

    return FP.pipe(
      sharesTotalRD,
      RD.fold(
        () => '',
        () => 'Loading...',
        (error) => intl.formatMessage({ id: 'common.error.api.limit' }, { errorMsg: error.message }),
        (total) =>
          isPrivate
            ? hiddenString
            : formatAssetAmountCurrency({
                amount: baseToAsset(total),
                asset: selectedPricePoolThor.asset,
                decimal: isUSDAsset(selectedPricePoolThor.asset) ? 2 : 4
              })
      )
    )
  }, [
    allSharesRD,
    protocol,
    intl,
    isPrivate,
    poolDetailsRD,
    pricePoolDataThor,
    pricePoolDataMaya,
    selectedPricePoolThor.asset
  ])

  const allRunePoolProviders = useRunePoolProviders(
    userChains$,
    addressByChain$,
    getLedgerAddress$,
    getRunePoolProvider$
  )
  const isRemoteSuccess = (provider: RunePoolProviderRD): provider is RD.RemoteSuccess<RunePoolProvider> => {
    return provider._tag === 'RemoteSuccess'
  }

  const renderRunePoolTotal = useMemo(() => {
    // Wrap allRunePoolProviders in RD.success
    const allRunePoolProvidersRD = RD.success(allRunePoolProviders)
    const calculateTotalDepositAmount = (allRunePoolProviders: Record<string, RunePoolProviderRD>): BaseAmount => {
      return Object.values(allRunePoolProviders)
        .filter(isRemoteSuccess) // Narrow down to only `RemoteSuccess` items
        .reduce((total, provider) => {
          // Safely access `provider.value.depositAmount` since TypeScript knows `provider` is `RemoteSuccess`
          return total.plus(provider.value.depositAmount)
        }, baseAmount(0)) // Start with zero
    }
    const runePoolTotalRD: BaseAmountRD = FP.pipe(
      RD.combine(allRunePoolProvidersRD),
      RD.map(
        ([allRunePoolProviders]) => calculateTotalDepositAmount(allRunePoolProviders) // Calculate total using the custom function
      )
    )

    return FP.pipe(
      runePoolTotalRD,
      RD.fold(
        // Initial loading state
        () => '',
        // Pending state
        () => '',
        // Error state
        (error) => intl.formatMessage({ id: 'common.error.api.limit' }, { errorMsg: error.message }),
        // Success state
        (total) =>
          isPrivate
            ? hiddenString
            : formatAssetAmountCurrency({
                amount: baseToAsset(total),
                asset: selectedPricePoolThor.asset,
                decimal: isUSDAsset(selectedPricePoolThor.asset) ? 2 : 4
              })
      )
    )
  }, [allRunePoolProviders, intl, isPrivate, selectedPricePoolThor.asset])

  const renderSaversTotal = useMemo(() => {
    const allSaverProvidersRD = RD.success(allSaverProviders)
    const saversTotalRD: BaseAmountRD = FP.pipe(
      RD.combine(allSaverProvidersRD, poolDetailsThorRD),
      RD.map(([allSaverProviders, poolDetails]) =>
        getSaversTotal(allSaverProviders, poolDetails, selectedPricePoolThor)
      )
    )

    return FP.pipe(
      saversTotalRD,
      RD.fold(
        // Initial loading state
        () => '',
        // Pending state
        () => '',
        // Error state
        (error) => intl.formatMessage({ id: 'common.error.api.limit' }, { errorMsg: error.message }),
        // Success state
        (total) =>
          isPrivate
            ? hiddenString
            : formatAssetAmountCurrency({
                amount: baseToAsset(total),
                asset: selectedPricePoolThor.asset,
                decimal: isUSDAsset(selectedPricePoolThor.asset) ? 2 : 4
              })
      )
    )
  }, [allSaverProviders, poolDetailsThorRD, selectedPricePoolThor, intl, isPrivate])
  const totalBalanceDisplay = useMemo(() => {
    const chainValues = Object.entries(balancesByChain).map(([_, balance]) =>
      isPrivate ? 0 : baseToAsset(balance).amount().toNumber()
    )
    const total = chainValues.reduce((acc, value) => acc + value, 0)
    const totalCyrpto = new CryptoAmount(assetToBase(assetAmount(total, 6)), AssetUSDC)
    const formattedTotal = isPrivate
      ? hiddenString
      : formatAssetAmountCurrency({
          asset: totalCyrpto.asset,
          amount: totalCyrpto.assetAmount,
          trimZeros: true,
          decimal: 0
        })

    return formattedTotal
  }, [balancesByChain, isPrivate])

  const calculatedTotal = [totalBalanceDisplay, renderSharesTotal, renderSaversTotal, renderBondTotal]
    .map((amount) => parseFloat(amount.replace(/[^0-9.-]+/g, '')))
    .reduce((acc, num) => (!isNaN(num) ? acc + num : acc), 0)

  const chainChartData = useMemo(() => {
    const balSumByChain: Record<string, number> = {}

    Object.entries(balancesByChain).forEach(([chain, balance]) => {
      const chainName = chain.split(':')[0]
      const chainBalAmount = baseToAsset(balance).amount().toNumber()
      if (Object.keys(balSumByChain).includes(chainName)) {
        balSumByChain[chainName] += chainBalAmount
      } else {
        balSumByChain[chainName] = chainBalAmount
      }
    })

    return Object.entries(balSumByChain).map(([chainName, balance]) => {
      return {
        name: chainName, // Add an index to make the key unique
        value: parseFloat(balance.toFixed(balance < 1 ? 2 : 0))
      }
    })
  }, [balancesByChain])

  const portfolioDatasource = useMemo(
    () => [
      { key: '1', title: intl.formatMessage({ id: 'common.wallets' }), amount: totalBalanceDisplay, action: 'Manage' },
      {
        key: '2',
        title: intl.formatMessage({ id: 'wallet.nav.poolshares' }),
        amount: renderSharesTotal,
        action: 'Manage'
      },
      { key: '3', title: intl.formatMessage({ id: 'wallet.nav.savers' }), amount: renderSaversTotal, action: 'Manage' },
      {
        key: '4',
        title: intl.formatMessage({ id: 'deposit.interact.actions.runePool' }),
        amount: renderRunePoolTotal,
        action: 'Manage'
      },
      { key: '5', title: intl.formatMessage({ id: 'wallet.nav.bonds' }), amount: renderBondTotal, action: 'Manage' }
    ],
    [totalBalanceDisplay, renderSharesTotal, renderSaversTotal, renderBondTotal, renderRunePoolTotal, intl]
  )

  const cardItemInfo = useMemo(
    () => [
      {
        title: intl.formatMessage({ id: 'common.wallets' }),
        value: totalBalanceDisplay,
        route: walletRoutes.base.path()
      },
      {
        title: intl.formatMessage({ id: 'wallet.nav.poolshares' }),
        value: renderSharesTotal,
        route: walletRoutes.poolShares.path()
      },
      {
        title: intl.formatMessage({ id: 'wallet.nav.savers' }),
        value: renderSaversTotal,
        route: walletRoutes.savers.path()
      },
      {
        title: intl.formatMessage({ id: 'deposit.interact.actions.runePool' }),
        value: renderRunePoolTotal,
        route: walletRoutes.runepool.path()
      },
      {
        title: intl.formatMessage({ id: 'wallet.nav.bonds' }),
        value: renderBondTotal,
        route: walletRoutes.bonds.path()
      }
    ],
    [intl, totalBalanceDisplay, renderSharesTotal, renderSaversTotal, renderBondTotal, renderRunePoolTotal]
  )

  const chartData = useMemo(() => {
    return portfolioDatasource.map(({ title, amount }) => {
      const value = amount.trim() ? parseFloat(amount.replace('$', '').replace(',', '').trim()) : 0
      return {
        name: title,
        value: parseFloat(value.toFixed(value < 1 ? 2 : 0))
      }
    })
  }, [portfolioDatasource])

  const filteredChainData = useMemo(() => chainChartData.filter((entry) => entry.value !== 0.0), [chainChartData])

  const refreshHandler = useCallback(async () => {
    const delay = 1000
    const chains = Array.from(enabledChains || []) // Safeguard

    for (const [index, chain] of chains.entries()) {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
      const lazyReload = reloadBalancesByChain(chain, DEFAULT_WALLET_TYPE)
      lazyReload()
    }
  }, [enabledChains])

  return (
    <>
      <div className="flex w-full justify-between pb-10px">
        <ProtocolSwitch protocol={protocol} setProtocol={setProtocol} />
        <RefreshButton onClick={refreshHandler}></RefreshButton>
      </div>
      <div className="flex flex-col rounded-lg bg-bg1 p-4 dark:bg-bg1d">
        <div className="flex justify-end">
          <RadioGroup options={options} activeIndex={activeIndex} onChange={setActiveIndex} />
        </div>
        <div className="flex flex-col items-center justify-center">
          <Styled.Title size="big" className="text-gray2 dark:text-gray2d">
            {intl.formatMessage({ id: 'wallet.balance.total.portfolio' })}
          </Styled.Title>
          <div className="mb-4 !text-[28px] text-text2 dark:text-text2d">{getCurrencyFormat(calculatedTotal)}</div>
        </div>
        <div className="mt-4 space-y-2">
          {activeIndex === PortfolioTabKey.CardView && (
            <div className="grid grid-cols-3 gap-4">
              {cardItemInfo.map(({ title, value, route }) => (
                <CardItem key={route} title={title} value={value} route={route} />
              ))}
            </div>
          )}
          {activeIndex === PortfolioTabKey.ChartView && (
            <div className="flex flex-col">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-1 flex-col rounded-lg border border-solid border-gray0 p-4 dark:border-gray0d">
                  <Styled.Title size="large" className="text-gray2 dark:text-gray2d">
                    {intl.formatMessage({ id: 'common.allocationByType' })}
                  </Styled.Title>
                  <div className="mt-8 flex items-center justify-center">
                    <PieChart chartData={chartData} showLabelLine />
                  </div>
                </div>
                <div className="flex flex-1 flex-col rounded-lg border border-solid border-gray0 p-4 dark:border-gray0d">
                  <Styled.Title size="large" className="text-gray2 dark:text-gray2d">
                    {intl.formatMessage({ id: 'common.allocationByChain' })}
                  </Styled.Title>
                  <div className="mt-8 flex items-center justify-center">
                    <PieChart chartData={filteredChainData} showLabelLine />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
