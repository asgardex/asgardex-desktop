import React, { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletType } from '../../../shared/wallet/types'
import { RefreshButton } from '../../components/uielements/button'
import { AssetsNav } from '../../components/wallet/assets'
import { TotalAssetValue } from '../../components/wallet/assets/TotalAssetValue'
import { TradeAssetsTableCollapsable } from '../../components/wallet/assets/TradeAssetsTableCollapsable'
import { ZERO_BASE_AMOUNT } from '../../const'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { to1e8BaseAmount } from '../../helpers/assetHelper'
import { getPoolPriceValue, RUNE_PRICE_POOL } from '../../helpers/poolHelper'
import { useMimirHalt } from '../../hooks/useMimirHalt'
import { useNetwork } from '../../hooks/useNetwork'
import { usePrivateData } from '../../hooks/usePrivateData'
import { TradeAccount } from '../../services/thorchain/types'
import { INITIAL_BALANCES_STATE, DEFAULT_BALANCES_FILTER } from '../../services/wallet/const'
import { ChainBalance, SelectedWalletAsset } from '../../services/wallet/types'

export const TradeAssetsView: React.FC = (): JSX.Element => {
  // const navigate = useNavigate()
  const intl = useIntl()

  const { balancesState$, setSelectedAsset } = useWalletContext()
  const { getTradeAccount$, reloadTradeAccount } = useThorchainContext()
  const { chainBalances$ } = useWalletContext()
  const { network } = useNetwork()
  const { isPrivate } = usePrivateData()

  const {
    service: {
      pools: { poolsState$, selectedPricePool$, pendingPoolsState$ }
    }
  } = useMidgardContext()

  const thorchainBalance$ = useMemo(() => {
    return FP.pipe(
      chainBalances$,
      RxOp.map((chainBalances) => {
        return chainBalances.filter((chainBalance: ChainBalance) => chainBalance.chain === THORChain)
      }),
      RxOp.map(O.fromNullable)
    )
  }, [chainBalances$])

  const useTradeAccountBalanceRD = (walletType: WalletType) => {
    return useObservableState(() => {
      return FP.pipe(
        thorchainBalance$,
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
                        (address) => getTradeAccount$(address, walletType) // Fetch trade account based on address and walletType
                      )
                    )
                )
              )
          )
        )
      )
    }, RD.pending)
  }

  // Create the observable streams for both 'keystore' and 'ledger'
  const [tradeAccountBalanceRD] = useTradeAccountBalanceRD('keystore')
  const [tradeAccountBalanceLedgerRD] = useTradeAccountBalanceRD('ledger')

  const [{ loading: loadingBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )

  const poolsRD = useObservableState(poolsState$, RD.pending)
  const pendingPoolsThorRD = useObservableState(pendingPoolsState$, RD.pending)
  const selectedPricePool = useObservableState(selectedPricePool$, RUNE_PRICE_POOL)

  const selectAssetHandler = useCallback(
    (selectedAsset: SelectedWalletAsset) => {
      setSelectedAsset(O.some(selectedAsset))
    },
    [setSelectedAsset]
  )
  const poolDetails = useMemo(() => RD.toNullable(poolsRD)?.poolDetails ?? [], [poolsRD])
  const poolsData = useMemo(() => RD.toNullable(poolsRD)?.poolsData ?? {}, [poolsRD])
  const pendingPoolsDetails = useMemo(() => RD.toNullable(pendingPoolsThorRD)?.poolDetails ?? [], [pendingPoolsThorRD])
  const { mimirHaltRD } = useMimirHalt()

  const disableRefresh = useMemo(() => RD.isPending(poolsRD) || loadingBalances, [loadingBalances, poolsRD])

  const refreshHandler = useCallback(async () => {
    reloadTradeAccount()
  }, [reloadTradeAccount])

  const combinedTradeAccountBalances: TradeAccount[] = [
    ...FP.pipe(
      tradeAccountBalanceRD,
      RD.getOrElse<Error, TradeAccount[]>(() => [])
    ),
    ...FP.pipe(
      tradeAccountBalanceLedgerRD,
      RD.getOrElse<Error, TradeAccount[]>(() => [])
    )
  ]

  const balances: Record<string, BaseAmount> = FP.pipe(
    combinedTradeAccountBalances,
    A.reduce({} as Record<string, BaseAmount>, (acc, account) => {
      const chainKey = `${account.asset.chain}:${account.walletType}`

      const value = getPoolPriceValue({
        balance: { asset: account.asset, amount: account.units },
        poolDetails,
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

  const keystoreError = FP.pipe(
    tradeAccountBalanceRD,
    RD.fold(
      () => O.none,
      () => O.none,
      (error) => O.some(error.message), // If error, return the message
      () => O.none // Success
    )
  )

  const ledgerError = FP.pipe(
    tradeAccountBalanceLedgerRD,
    RD.fold(
      () => O.none,
      () => O.none,
      (error) => O.some(error.message), // If error, return the message
      () => O.none // Success
    )
  )

  const errors: Record<string, string> = {
    ...(O.isSome(keystoreError) ? { keystore: keystoreError.value } : {}),
    ...(O.isSome(ledgerError) ? { ledger: ledgerError.value } : {})
  }
  return (
    <>
      <div className="flex w-full justify-end pb-20px">
        <RefreshButton onClick={refreshHandler} />
      </div>
      <AssetsNav />
      <TotalAssetValue
        balancesByChain={balances}
        errorsByChain={errors}
        title={intl.formatMessage({ id: 'wallet.balance.total.tradeAssets' })}
        info={intl.formatMessage({ id: 'wallet.balance.total.tradeAssets.info' })}
        hidePrivateData={isPrivate}
      />

      <TradeAssetsTableCollapsable
        disableRefresh={disableRefresh}
        tradeAccountBalances={combinedTradeAccountBalances}
        pricePool={selectedPricePool}
        poolDetails={poolDetails}
        pendingPoolDetails={pendingPoolsDetails}
        poolsData={poolsData}
        selectAssetHandler={selectAssetHandler}
        mimirHalt={mimirHaltRD}
        network={network}
        hidePrivateData={isPrivate}
      />
    </>
  )
}
