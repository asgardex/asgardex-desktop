import React, { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { Dex } from '../../../shared/api/types'
import { DEFAULT_ENABLED_CHAINS, EnabledChain } from '../../../shared/utils/chain'
import { RefreshButton } from '../../components/uielements/button'
import { AssetsNav } from '../../components/wallet/assets'
import { AssetsTableCollapsable } from '../../components/wallet/assets/AssetsTableCollapsable'
import type { AssetAction } from '../../components/wallet/assets/AssetsTableCollapsable'
import { TotalAssetValue } from '../../components/wallet/assets/TotalAssetValue'
import { CHAIN_WEIGHTS_THOR, CHAIN_WEIGHTS_MAYA } from '../../const'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { MAYA_PRICE_POOL } from '../../helpers/poolHelperMaya'
import { useDex } from '../../hooks/useDex'
import { useMayaScanPrice } from '../../hooks/useMayascanPrice'
import { useMimirHalt } from '../../hooks/useMimirHalt'
import { useNetwork } from '../../hooks/useNetwork'
import { usePrivateData } from '../../hooks/usePrivateData'
import { useTotalWalletBalance } from '../../hooks/useWalletBalance'
import * as walletRoutes from '../../routes/wallet'
import { userChains$ } from '../../services/storage/userChains'
import { reloadBalancesByChain } from '../../services/wallet'
import { INITIAL_BALANCES_STATE, DEFAULT_BALANCES_FILTER } from '../../services/wallet/const'
import { ChainBalances, SelectedWalletAsset } from '../../services/wallet/types'

export const AssetsView: React.FC = (): JSX.Element => {
  const navigate = useNavigate()
  const intl = useIntl()

  const { balancesState$, setSelectedAsset } = useWalletContext()
  const { network } = useNetwork()
  const { dex } = useDex()
  const { mayaScanPriceRD } = useMayaScanPrice()
  const { isPrivate } = usePrivateData()

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
    const getChainWeight = (chain: Chain, dex: Dex) => {
      const weights = dex.chain === THORChain ? CHAIN_WEIGHTS_THOR : CHAIN_WEIGHTS_MAYA
      return enabledChains.has(chain) ? weights[chain] : Infinity
    }

    // First, filter out duplicates
    const uniqueBalances = getUniqueChainBalances(chainBalances)

    // Then, sort the unique balances
    return uniqueBalances.sort((a, b) => getChainWeight(a.chain, dex) - getChainWeight(b.chain, dex))
  }, [chainBalances, dex, enabledChains])

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
          navigate(walletRoutes.interact.path({ interactType: 'bond' }))
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
  const { mimirHaltRD } = useMimirHalt()

  const disableRefresh = useMemo(() => RD.isPending(poolsRD) || loadingBalances, [loadingBalances, poolsRD])

  const refreshHandler = useCallback(async () => {
    const delay = 1000
    const chains = Array.from(enabledChains || []) // Safeguard

    for (const [index, chain] of chains.entries()) {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
      const lazyReload = reloadBalancesByChain(chain)
      lazyReload()
    }
  }, [enabledChains])

  return (
    <>
      <div className="flex w-full justify-end pb-10px">
        <RefreshButton onClick={refreshHandler}></RefreshButton>
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
        dex={dex}
        mayaScanPrice={mayaScanPriceRD}
        disabledChains={disabledChains}
      />
    </>
  )
}
