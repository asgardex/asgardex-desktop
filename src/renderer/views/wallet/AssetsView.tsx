import React, { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { BaseAmount, Chain } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { Dex } from '../../../shared/api/types'
import { isEnabledChain } from '../../../shared/utils/chain'
import { RefreshButton } from '../../components/uielements/button'
import { AssetsNav } from '../../components/wallet/assets'
import { AssetsTableCollapsable } from '../../components/wallet/assets/AssetsTableCollapsable'
import type { AssetAction } from '../../components/wallet/assets/AssetsTableCollapsable'
import { TotalAssetValue } from '../../components/wallet/assets/TotalAssetValue'
import { CHAIN_WEIGHTS_THOR, CHAIN_WEIGHTS_MAYA } from '../../const'
import { ZERO_BASE_AMOUNT } from '../../const'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { to1e8BaseAmount } from '../../helpers/assetHelper'
import { RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { getPoolPriceValue } from '../../helpers/poolHelper'
import { MAYA_PRICE_POOL } from '../../helpers/poolHelperMaya'
import { getPoolPriceValue as getPoolPriceValueM } from '../../helpers/poolHelperMaya'
import { useDex } from '../../hooks/useDex'
import { useMayaScanPrice } from '../../hooks/useMayascanPrice'
import { useMimirHalt } from '../../hooks/useMimirHalt'
import { useNetwork } from '../../hooks/useNetwork'
import { usePrivateData } from '../../hooks/usePrivateData'
import * as walletRoutes from '../../routes/wallet'
import { reloadBalancesByChain } from '../../services/wallet'
import { INITIAL_BALANCES_STATE, DEFAULT_BALANCES_FILTER } from '../../services/wallet/const'
import { ChainBalances, SelectedWalletAsset } from '../../services/wallet/types'

export const AssetsView: React.FC = (): JSX.Element => {
  const navigate = useNavigate()
  const intl = useIntl()

  const { chainBalances$, balancesState$, setSelectedAsset } = useWalletContext()
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

  const combinedBalances$ = Rx.combineLatest([
    chainBalances$,
    poolsState$,
    selectedPricePool$,
    mayaPoolsState$,
    mayaSelectedPricePool$
  ]).pipe(
    RxOp.map(([chainBalances, poolsStateRD, selectedPricePool, poolsStateMayaRD, selectedPricePoolMaya]) => {
      const balancesByChain: Record<string, BaseAmount> = {}
      const errorsByChain: Record<string, string> = {}

      chainBalances.forEach((chainBalance) => {
        if (chainBalance.balancesType === 'all') {
          FP.pipe(
            chainBalance.balances,
            RD.fold(
              () => {}, // Ignore initial/loading states
              () => {},
              (error) => {
                errorsByChain[chainBalance.chain] = `${error.msg} (errorId: ${error.errorId})`
              },
              (walletBalances) => {
                const totalForChain = walletBalances.reduce((acc, { asset, amount }) => {
                  if (amount.amount().gt(0)) {
                    let value = getPoolPriceValue({
                      balance: { asset, amount },
                      poolDetails: RD.isSuccess(poolsStateRD) ? poolsStateRD.value.poolDetails : [],
                      pricePool: selectedPricePool
                    })
                    if (O.isNone(value)) {
                      value = getPoolPriceValueM({
                        balance: { asset, amount },
                        poolDetails: RD.isSuccess(poolsStateMayaRD) ? poolsStateMayaRD.value.poolDetails : [],
                        pricePool: selectedPricePoolMaya
                      })
                    }
                    acc = acc.plus(to1e8BaseAmount(O.getOrElse(() => ZERO_BASE_AMOUNT)(value)))
                  }
                  return acc
                }, ZERO_BASE_AMOUNT)
                balancesByChain[`${chainBalance.chain}:${chainBalance.walletType}`] = totalForChain
              }
            )
          )
        }
      })

      return { chainBalances, balancesByChain, errorsByChain }
    })
  )

  const [{ chainBalances, balancesByChain, errorsByChain }] = useObservableState(() => combinedBalances$, {
    chainBalances: [],
    balancesByChain: {},
    errorsByChain: {}
  })

  const getChainWeight = (chain: Chain, dex: Dex) => {
    const weights = dex === 'THOR' ? CHAIN_WEIGHTS_THOR : CHAIN_WEIGHTS_MAYA
    return isEnabledChain(chain) ? weights[chain] : Infinity
  }
  const getUniqueChainBalances = (balances: ChainBalances) => {
    const seen = new Set()
    return balances.filter((balance) => {
      const key = `${balance.chain}-${balance.walletType}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  const sortedBalances = useMemo(() => {
    // First, filter out duplicates
    const uniqueBalances = getUniqueChainBalances(chainBalances)

    // Then, sort the unique balances
    return uniqueBalances.sort((a, b) => getChainWeight(a.chain, dex) - getChainWeight(b.chain, dex))
  }, [chainBalances, dex])

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

  const chains = useMemo(
    () =>
      FP.pipe(
        sortedBalances,
        A.map(({ chain }) => chain)
      ),
    [sortedBalances]
  )

  const refreshHandler = useCallback(async () => {
    const delay = 1000 // Delay in milliseconds

    for (const [index, chain] of chains.entries()) {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      const lazyReload = reloadBalancesByChain(chain)
      lazyReload() // Invoke the lazy function
    }
  }, [chains])

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
      />
    </>
  )
}
