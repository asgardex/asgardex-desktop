import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'
import { debounce } from 'lodash'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { DEFAULT_ENABLED_CHAINS, EnabledChain } from '../../../shared/utils/chain'
import { RefreshButton } from '../../components/uielements/button'
import { AssetsNav } from '../../components/wallet/assets'
import { AssetsTableCollapsable } from '../../components/wallet/assets/AssetsTableCollapsable'
import type { AssetAction } from '../../components/wallet/assets/AssetsTableCollapsable'
import { TotalAssetValue } from '../../components/wallet/assets/TotalAssetValue'
import { InteractType } from '../../components/wallet/txs/interact/Interact.types'
import { CHAIN_WEIGHTS_THOR, DEFAULT_WALLET_TYPE } from '../../const'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { MAYA_PRICE_POOL } from '../../helpers/poolHelperMaya'
import { useMayaScanPrice } from '../../hooks/useMayascanPrice'
import { useThorchainMimirHalt } from '../../hooks/useMimirHalt'
import { useNetwork } from '../../hooks/useNetwork'
import { useTotalWalletBalance } from '../../hooks/useWalletBalance'
import * as walletRoutes from '../../routes/wallet'
import { userChains$ } from '../../services/storage/userChains'
import { reloadBalancesByChain } from '../../services/wallet'
import { INITIAL_BALANCES_STATE, DEFAULT_BALANCES_FILTER } from '../../services/wallet/const'
import { ChainBalances, SelectedWalletAsset } from '../../services/wallet/types'
import { useApp } from '../../store/app/hooks'
import { useCoingecko } from '../../store/gecko/hooks'
import { GECKO_MAP } from '../../types/generated/geckoMap'

export const AssetsView: React.FC = (): JSX.Element => {
  const navigate = useNavigate()
  const intl = useIntl()

  const { balancesState$, setSelectedAsset } = useWalletContext()
  const { network } = useNetwork()
  const { mayaScanPriceRD } = useMayaScanPrice()
  const { isPrivate } = useApp()
  const { geckoPriceMap, fetchPrice: fetchCoingeckoPrice } = useCoingecko()

  const {
    service: {
      pools: { poolsState$, selectedPricePool$, pendingPoolsState$ }
    }
  } = useMidgardContext()

  const {
    service: {
      pools: {
        poolsState$: mayaPoolsState$,
        selectedPricePool$: mayaSelectedPricePool$,
        pendingPoolsState$: pendingPoolsStateMaya$
      }
    }
  } = useMidgardMayaContext()

  const combinedBalances$ = useTotalWalletBalance()

  const [enabledChains, setEnabledChains] = useState<Set<EnabledChain>>(new Set())
  const [disabledChains, setDisabledChains] = useState<EnabledChain[]>([])

  useEffect(() => {
    const subscription = userChains$.subscribe((chains: EnabledChain[]) => {
      setEnabledChains(new Set(chains))
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const defaultChains = Object.keys(DEFAULT_ENABLED_CHAINS) as EnabledChain[]
    const disabled = defaultChains.filter((chain) => !enabledChains.has(chain))
    setDisabledChains(disabled)
  }, [enabledChains])

  const [{ chainBalances, balancesByChain, errorsByChain }] = useObservableState(() => combinedBalances$, {
    chainBalances: [],
    balancesByChain: {},
    errorsByChain: {}
  })

  const sortedBalances = useMemo(() => {
    const getUniqueChainBalances = (balances: ChainBalances) => {
      const seen = new Set()
      return balances.filter((balance) => {
        if (!enabledChains.has(balance.chain)) {
          return false
        }
        const key = `${balance.chain}-${balance.walletType}`
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
    }
    const getChainWeight = (chain: Chain) => {
      // Will apply CHAIN_WEIGHTS_THOR only
      return enabledChains.has(chain) ? CHAIN_WEIGHTS_THOR[chain] : Infinity
    }

    // First, filter out duplicates
    const uniqueBalances = getUniqueChainBalances(chainBalances)

    // Then, sort the unique balances
    return uniqueBalances.sort((a, b) => getChainWeight(a.chain) - getChainWeight(b.chain))
  }, [chainBalances, enabledChains])

  const availableAssets = useMemo(() => {
    let assetArr: string[] = []

    sortedBalances.forEach(({ balances }) => {
      const assetIds =
        balances._tag === 'RemoteSuccess' ? balances.value.map(({ asset }) => asset.symbol.toUpperCase()) : []
      assetArr = [...assetArr, ...assetIds]
    })

    // Use Set to remove duplicates
    const uniqueAssets = Array.from(new Set(assetArr))

    // Map to Gecko IDs and filter out null values
    return uniqueAssets.map((item) => GECKO_MAP?.[item] ?? null).filter((item) => item)
  }, [sortedBalances])

  const [lastFetchedAssets, setLastFetchedAssets] = useState<string>('')

  const allChainsLoaded = useMemo(() => {
    return chainBalances.every(({ balances }) => balances._tag !== 'RemoteInitial' && balances._tag !== 'RemotePending')
  }, [chainBalances])

  const debouncedFetchCoingeckoPrice = useMemo(
    () =>
      debounce((assets: string) => {
        fetchCoingeckoPrice(assets)
      }, 300),
    [fetchCoingeckoPrice]
  )
  useEffect(() => {
    if (allChainsLoaded) {
      const currentAssets = availableAssets.join(',')
      if (currentAssets !== lastFetchedAssets) {
        debouncedFetchCoingeckoPrice(currentAssets)
        setLastFetchedAssets(currentAssets)
      }
    }
  }, [allChainsLoaded, availableAssets, debouncedFetchCoingeckoPrice, lastFetchedAssets])

  const [{ loading: loadingBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )

  const selectedPricePoolMaya = useObservableState(mayaSelectedPricePool$, MAYA_PRICE_POOL)
  const poolsMayaRD = useObservableState(mayaPoolsState$, RD.pending)
  const poolsRD = useObservableState(poolsState$, RD.pending)
  const pendingPoolsThorRD = useObservableState(pendingPoolsState$, RD.pending)
  const pendingPoolsMayaRD = useObservableState(pendingPoolsStateMaya$, RD.pending)
  const selectedPricePool = useObservableState(selectedPricePool$, RUNE_PRICE_POOL)

  const selectAssetHandler = useCallback(
    (selectedAsset: SelectedWalletAsset) => {
      setSelectedAsset(O.some(selectedAsset))
      navigate(walletRoutes.assetDetail.path())
    },
    [navigate, setSelectedAsset]
  )

  const assetHandler = useCallback(
    (selectedAsset: SelectedWalletAsset, action: AssetAction) => {
      setSelectedAsset(O.some(selectedAsset))
      switch (action) {
        case 'send':
          navigate(walletRoutes.send.path())
          break
        case 'deposit':
          navigate(walletRoutes.interact.path({ interactType: InteractType.Bond }))
          break
      }
    },
    [navigate, setSelectedAsset]
  )

  const poolDetails = useMemo(() => RD.toNullable(poolsRD)?.poolDetails ?? [], [poolsRD])
  const poolDetailsMaya = useMemo(() => RD.toNullable(poolsMayaRD)?.poolDetails ?? [], [poolsMayaRD])
  const poolsData = useMemo(() => RD.toNullable(poolsRD)?.poolsData ?? {}, [poolsRD])
  const poolsDataMaya = useMemo(() => RD.toNullable(poolsMayaRD)?.poolsData ?? {}, [poolsMayaRD])
  const pendingPoolsDetails = useMemo(() => RD.toNullable(pendingPoolsThorRD)?.poolDetails ?? [], [pendingPoolsThorRD])
  const pendingPoolsDetailsMaya = useMemo(
    () => RD.toNullable(pendingPoolsMayaRD)?.poolDetails ?? [],
    [pendingPoolsMayaRD]
  )
  const { mimirHaltRD } = useThorchainMimirHalt()

  const disableRefresh = useMemo(() => RD.isPending(poolsRD) || loadingBalances, [loadingBalances, poolsRD])

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
      <div className="flex w-full justify-end pb-20px">
        <RefreshButton onClick={refreshHandler} />
      </div>
      <AssetsNav />
      <TotalAssetValue
        balancesByChain={balancesByChain}
        errorsByChain={errorsByChain}
        title={intl.formatMessage({ id: 'wallet.balance.total.poolAssets' })}
        info={intl.formatMessage({ id: 'wallet.balance.total.poolAssets.info' })}
        hidePrivateData={isPrivate}
      />

      <AssetsTableCollapsable
        disableRefresh={disableRefresh}
        chainBalances={sortedBalances}
        pricePool={selectedPricePool}
        geckoPrice={geckoPriceMap}
        mayaPricePool={selectedPricePoolMaya}
        poolDetails={poolDetails}
        poolDetailsMaya={poolDetailsMaya}
        pendingPoolDetails={pendingPoolsDetails}
        pendingPoolsDetailsMaya={pendingPoolsDetailsMaya}
        poolsData={poolsData}
        poolsDataMaya={poolsDataMaya}
        selectAssetHandler={selectAssetHandler}
        assetHandler={assetHandler}
        mimirHalt={mimirHaltRD}
        network={network}
        hidePrivateData={isPrivate}
        mayaScanPrice={mayaScanPriceRD}
        disabledChains={disabledChains}
      />
    </>
  )
}
