import React, { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import * as RxOp from 'rxjs/operators'

import { RefreshButton } from '../../components/uielements/button'
import { AssetsNav } from '../../components/wallet/assets'
import { AssetsTableCollapsable } from '../../components/wallet/assets/AssetsTableCollapsable'
import type { AssetAction } from '../../components/wallet/assets/AssetsTableCollapsable'
import { TotalValue } from '../../components/wallet/assets/TotalValue'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { useMimirHalt } from '../../hooks/useMimirHalt'
import { useNetwork } from '../../hooks/useNetwork'
import { usePrivateData } from '../../hooks/usePrivateData'
import { useTotalWalletBalance } from '../../hooks/useWalletBalance'
import * as walletRoutes from '../../routes/wallet'
import { reloadBalancesByChain } from '../../services/wallet'
import { INITIAL_BALANCES_STATE, DEFAULT_BALANCES_FILTER } from '../../services/wallet/const'
import { ChainBalances, SelectedWalletAsset } from '../../services/wallet/types'

export const AssetsView: React.FC = (): JSX.Element => {
  const navigate = useNavigate()
  const intl = useIntl()

  const { chainBalances$, balancesState$, setSelectedAsset } = useWalletContext()

  const { network } = useNetwork()

  const { isPrivate } = usePrivateData()

  const [chainBalances] = useObservableState(
    () =>
      FP.pipe(
        chainBalances$,
        RxOp.map<ChainBalances, ChainBalances>((chainBalances) =>
          FP.pipe(
            chainBalances,
            // we show all balances
            A.filter(({ balancesType }) => balancesType === 'all')
          )
        )
      ),
    []
  )

  const [{ loading: loadingBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )
  const {
    service: {
      pools: { poolsState$, selectedPricePool$, pendingPoolsState$ }
    }
  } = useMidgardContext()

  const { total: totalWalletBalances } = useTotalWalletBalance()

  const poolsRD = useObservableState(poolsState$, RD.pending)
  const pendingPoolsRD = useObservableState(pendingPoolsState$, RD.pending)

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

  const poolDetails = RD.toNullable(poolsRD)?.poolDetails ?? []
  const poolsData = RD.toNullable(poolsRD)?.poolsData ?? {}

  const pendingPoolsDetails = RD.toNullable(pendingPoolsRD)?.poolDetails ?? []

  const { mimirHaltRD } = useMimirHalt()

  const disableRefresh = useMemo(() => RD.isPending(poolsRD) || loadingBalances, [loadingBalances, poolsRD])

  const chains = useMemo(
    () =>
      FP.pipe(
        chainBalances,
        A.map(({ chain }) => chain)
      ),
    [chainBalances]
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
      <TotalValue
        total={totalWalletBalances}
        pricePool={selectedPricePool}
        title={intl.formatMessage({ id: 'wallet.balance.total.poolAssets' })}
        info={intl.formatMessage({ id: 'wallet.balance.total.poolAssets.info' })}
        hidePrivateData={isPrivate}
      />

      <AssetsTableCollapsable
        disableRefresh={disableRefresh}
        chainBalances={chainBalances}
        pricePool={selectedPricePool}
        poolDetails={poolDetails}
        pendingPoolDetails={pendingPoolsDetails}
        poolsData={poolsData}
        selectAssetHandler={selectAssetHandler}
        assetHandler={assetHandler}
        mimirHalt={mimirHaltRD}
        network={network}
        hidePrivateData={isPrivate}
      />
    </>
  )
}
