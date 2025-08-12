import { useCallback, useMemo, useState } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount, Chain } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletType } from '../../../shared/wallet/types'
import { RefreshButton } from '../../components/uielements/button'
import { Spin } from '../../components/uielements/spin'
import { AssetsNav } from '../../components/wallet/assets'
import { TotalAssetValue } from '../../components/wallet/assets/TotalAssetValue'
import { TradeAssetsTableCollapsable } from '../../components/wallet/assets/TradeAssetsTableCollapsable'
import { ZERO_BASE_AMOUNT } from '../../const'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { to1e8BaseAmount } from '../../helpers/assetHelper'
import { getPoolPriceValue, RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { getPoolPriceValue as getPoolPriceValueMaya, MAYA_PRICE_POOL } from '../../helpers/poolHelperMaya'
import { useObserveMayaScanPrice } from '../../hooks/useMayascanPrice'
import { useThorchainMimirHalt } from '../../hooks/useMimirHalt'
import { useNetwork } from '../../hooks/useNetwork'
import { TradeAccount } from '../../services/thorchain/types'
import { INITIAL_BALANCES_STATE, DEFAULT_BALANCES_FILTER } from '../../services/wallet/const'
import { ChainBalance, SelectedWalletAsset } from '../../services/wallet/types'
import { useApp } from '../../store/app/hooks'

export const TradeAssetsView = (): JSX.Element => {
  const intl = useIntl()
  const { balancesState$, setSelectedAsset } = useWalletContext()
  const { getTradeAccount$: getTradeAccountThor, reloadTradeAccount: reloadTradeAccountThor } = useThorchainContext()
  const { getTradeAccount$: getTradeAccountMaya, reloadTradeAccount: reloadTradeAccountMaya } = useMayachainContext()
  const { chainBalances$ } = useWalletContext()
  const { network } = useNetwork()
  const { isPrivate } = useApp()
  const { mayaScanPriceRD } = useObserveMayaScanPrice()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const {
    service: {
      pools: { poolsState$, selectedPricePool$, pendingPoolsState$ }
    }
  } = useMidgardContext()
  const {
    service: {
      pools: {
        poolsState$: poolsStateMaya$,
        selectedPricePool$: selectedPricePoolMaya$,
        pendingPoolsState$: pendingPoolsStateMaya$
      }
    }
  } = useMidgardMayaContext()

  // Generic function to fetch trade account balances for a given chain
  const useTradeAccountBalanceRD = (
    chain: string,
    walletType: WalletType,
    getTradeAccount: (address: string, walletType: WalletType) => Rx.Observable<RD.RemoteData<Error, TradeAccount[]>>
  ) => {
    return useObservableState(() => {
      return FP.pipe(
        chainBalances$,
        RxOp.map((chainBalances) => chainBalances.filter((chainBalance: ChainBalance) => chainBalance.chain === chain)),
        RxOp.map(O.fromNullable),
        RxOp.switchMap(
          O.fold(
            () => Rx.of(RD.initial),
            (balances) =>
              FP.pipe(
                balances,
                A.findFirst((balance) => balance.walletType === walletType),
                O.fold(
                  () => Rx.of(RD.initial),
                  ({ walletAddress }) =>
                    FP.pipe(
                      walletAddress,
                      O.fold(
                        () => Rx.of(RD.initial),
                        (address) => getTradeAccount(address, walletType)
                      )
                    )
                )
              )
          )
        )
      )
    }, RD.pending)
  }

  // Fetch balances for Thorchain and Mayachain for both wallet types
  const [tradeAccountBalanceThorKeystoreRD] = useTradeAccountBalanceRD(
    THORChain,
    WalletType.Keystore,
    getTradeAccountThor
  )
  const [tradeAccountBalanceThorLedgerRD] = useTradeAccountBalanceRD(THORChain, WalletType.Ledger, getTradeAccountThor)
  const [tradeAccountBalanceMayaKeystoreRD] = useTradeAccountBalanceRD(
    MAYAChain,
    WalletType.Keystore,
    getTradeAccountMaya
  )
  const [tradeAccountBalanceMayaLedgerRD] = useTradeAccountBalanceRD(MAYAChain, WalletType.Ledger, getTradeAccountMaya)

  const [{ loading: loadingBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )

  // Thorchain pool data
  const poolsRD = useObservableState(poolsState$, RD.pending)
  const pendingPoolsThorRD = useObservableState(pendingPoolsState$, RD.pending)
  const selectedPricePool = useObservableState(selectedPricePool$, RUNE_PRICE_POOL)

  // Mayachain pool data
  const poolsMayaRD = useObservableState(poolsStateMaya$, RD.pending)
  const pendingPoolsMayaRD = useObservableState(pendingPoolsStateMaya$, RD.pending)
  const selectedPricePoolMaya = useObservableState(selectedPricePoolMaya$, MAYA_PRICE_POOL)

  const selectAssetHandler = useCallback(
    (selectedAsset: SelectedWalletAsset) => {
      setSelectedAsset(O.some(selectedAsset))
    },
    [setSelectedAsset]
  )

  const poolDetails = useMemo(() => RD.toNullable(poolsRD)?.poolDetails ?? [], [poolsRD])
  const poolsData = useMemo(() => RD.toNullable(poolsRD)?.poolsData ?? {}, [poolsRD])
  const pendingPoolsDetails = useMemo(() => RD.toNullable(pendingPoolsThorRD)?.poolDetails ?? [], [pendingPoolsThorRD])

  const poolDetailsMaya = useMemo(() => RD.toNullable(poolsMayaRD)?.poolDetails ?? [], [poolsMayaRD])
  const poolsDataMaya = useMemo(() => RD.toNullable(poolsMayaRD)?.poolsData ?? {}, [poolsMayaRD])
  const pendingPoolsDetailsMaya = useMemo(
    () => RD.toNullable(pendingPoolsMayaRD)?.poolDetails ?? [],
    [pendingPoolsMayaRD]
  )

  const { mimirHaltRD } = useThorchainMimirHalt()
  const disableRefresh = useMemo(
    () => RD.isPending(poolsRD) || RD.isPending(poolsMayaRD) || loadingBalances || isRefreshing,
    [loadingBalances, poolsRD, poolsMayaRD, isRefreshing]
  )

  const refreshHandler = useCallback(
    async (protocol?: Chain) => {
      setIsRefreshing(true)
      try {
        if (protocol === THORChain) {
          await reloadTradeAccountThor()
        } else if (protocol === MAYAChain) {
          await reloadTradeAccountMaya()
        } else {
          await Promise.all([reloadTradeAccountThor(), reloadTradeAccountMaya()])
        }
      } finally {
        setIsRefreshing(false) // Reset loading state
      }
    },
    [reloadTradeAccountThor, reloadTradeAccountMaya]
  )

  // Combine trade account balances from both Thorchain and Mayachain
  const combinedTradeAccountBalances: TradeAccount[] = [
    ...FP.pipe(
      tradeAccountBalanceThorKeystoreRD,
      RD.getOrElse<Error, TradeAccount[]>(() => [])
    ),
    ...FP.pipe(
      tradeAccountBalanceThorLedgerRD,
      RD.getOrElse<Error, TradeAccount[]>(() => [])
    ),
    ...FP.pipe(
      tradeAccountBalanceMayaKeystoreRD,
      RD.getOrElse<Error, TradeAccount[]>(() => [])
    )
  ]

  // Calculate combined balances
  const balances: Record<string, BaseAmount> = FP.pipe(
    combinedTradeAccountBalances,
    A.reduce({} as Record<string, BaseAmount>, (acc, account) => {
      const chainKey = `${account.asset.chain}:${account.walletType}:${account.protocol}`
      const isMayaChain = account.protocol === MAYAChain

      const value = isMayaChain
        ? getPoolPriceValueMaya({
            balance: { asset: account.asset, amount: account.units },
            poolDetails: poolDetailsMaya,
            pricePool: selectedPricePoolMaya,
            mayaPriceRD: mayaScanPriceRD
          })
        : getPoolPriceValue({
            balance: { asset: account.asset, amount: account.units },
            poolDetails: poolDetails,
            pricePool: selectedPricePool
          })

      const amount = to1e8BaseAmount(O.getOrElse(() => ZERO_BASE_AMOUNT)(value))

      if (acc[chainKey]) {
        acc[chainKey] = acc[chainKey].plus(amount)
      } else {
        acc[chainKey] = amount
      }

      return acc
    }),
    (result) => (Object.keys(result).length === 0 ? { 'EMPTY:EMPTY': ZERO_BASE_AMOUNT } : result)
  )

  const keystoreErrorThor = FP.pipe(
    tradeAccountBalanceThorKeystoreRD,
    RD.fold(
      () => O.none,
      () => O.none,
      (error) => O.some(error.message),
      () => O.none
    )
  )

  const ledgerErrorThor = FP.pipe(
    tradeAccountBalanceThorLedgerRD,
    RD.fold(
      () => O.none,
      () => O.none,
      (error) => O.some(error.message),
      () => O.none
    )
  )

  const keystoreErrorMaya = FP.pipe(
    tradeAccountBalanceMayaKeystoreRD,
    RD.fold(
      () => O.none,
      () => O.none,
      (error) => O.some(error.message),
      () => O.none
    )
  )

  const ledgerErrorMaya = FP.pipe(
    tradeAccountBalanceMayaLedgerRD,
    RD.fold(
      () => O.none,
      () => O.none,
      (error) => O.some(error.message),
      () => O.none
    )
  )

  const errors: Record<string, string> = {
    ...(O.isSome(keystoreErrorThor) ? { 'thorchain-keystore': keystoreErrorThor.value } : {}),
    ...(O.isSome(ledgerErrorThor) ? { 'thorchain-ledger': ledgerErrorThor.value } : {}),
    ...(O.isSome(keystoreErrorMaya) ? { 'mayachain-keystore': keystoreErrorMaya.value } : {}),
    ...(O.isSome(ledgerErrorMaya) ? { 'mayachain-ledger': ledgerErrorMaya.value } : {})
  }

  return (
    <>
      <div className="flex w-full justify-end pb-20px">
        <RefreshButton onClick={() => refreshHandler()} />
      </div>
      <AssetsNav />
      {isRefreshing && (
        <div className="flex justify-center items-center py-4">
          <Spin /> {/* Display spinner during refresh */}
        </div>
      )}
      <TotalAssetValue
        balancesByChain={balances}
        errorsByChain={errors}
        title={intl.formatMessage({ id: 'wallet.balance.total.tradeAssets' })}
        info={intl.formatMessage({ id: 'wallet.balance.total.tradeAssets.info' })}
        hidePrivateData={isPrivate}
      />
      <TradeAssetsTableCollapsable
        chainBalances={chainBalances$}
        disableRefresh={disableRefresh}
        tradeAccountBalances={combinedTradeAccountBalances}
        pricePool={selectedPricePool}
        pricePoolMaya={selectedPricePoolMaya}
        poolDetails={poolDetails}
        poolDetailsMaya={poolDetailsMaya}
        pendingPoolDetails={pendingPoolsDetails}
        pendingPoolDetailsMaya={pendingPoolsDetailsMaya}
        poolsData={poolsData}
        poolsDataMaya={poolsDataMaya}
        selectAssetHandler={selectAssetHandler}
        mimirHalt={mimirHaltRD}
        network={network}
        hidePrivateData={isPrivate}
        refreshHandler={refreshHandler}
        isRefreshing={isRefreshing}
      />
    </>
  )
}
