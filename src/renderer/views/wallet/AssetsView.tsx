import React, { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import * as RxOp from 'rxjs/operators'

import { Dex } from '../../../shared/api/types'
import { isEnabledChain } from '../../../shared/utils/chain'
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

  const getChainWeight = (chain: Chain, dex: Dex) => {
    const weights = dex === 'THOR' ? CHAIN_WEIGHTS_THOR : CHAIN_WEIGHTS_MAYA

    // If the chain is enabled, use its defined weight, otherwise sort it to the end
    return isEnabledChain(chain) ? weights[chain] : Infinity
  }

  const sortedBalances = chainBalances.sort((a, b) => {
    const weightA = getChainWeight(a.chain, dex) // selectedDex should be either 'MAYA' or 'THOR'
    const weightB = getChainWeight(b.chain, dex)
    return weightA - weightB
  })

  const [{ loading: loadingBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )
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

  const selectedPricePoolMaya = useObservableState(mayaSelectedPricePool$, MAYA_PRICE_POOL)

  const poolsMayaRD = useObservableState(mayaPoolsState$, RD.pending)

  const { balancesByChain, errorsByChain } = useTotalWalletBalance()

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

  const poolDetails = RD.toNullable(poolsRD)?.poolDetails ?? []
  const poolDetailsMaya = RD.toNullable(poolsMayaRD)?.poolDetails ?? []
  const poolsData = RD.toNullable(poolsRD)?.poolsData ?? {}
  const poolsDataMaya = RD.toNullable(poolsMayaRD)?.poolsData ?? {}

  const pendingPoolsDetails = RD.toNullable(pendingPoolsThorRD)?.poolDetails ?? []
  const pendingPoolsDetailsMaya = RD.toNullable(pendingPoolsMayaRD)?.poolDetails ?? []

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
        pendingPoolDetailsMaya={pendingPoolsDetailsMaya}
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
