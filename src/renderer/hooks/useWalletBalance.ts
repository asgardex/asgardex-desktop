import * as RD from '@devexperts/remote-data-ts'
import { BaseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { EnabledChain, isExcludedFromTotals } from '../../shared/utils/chain'
import { ZERO_BASE_AMOUNT } from '../const'
import { useMidgardContext } from '../contexts/MidgardContext'
import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import { useWalletContext } from '../contexts/WalletContext'
import { to1e8BaseAmount } from '../helpers/assetHelper'
import { getPoolPriceValue } from '../helpers/poolHelper'
import { getPoolPriceValue as getPoolPriceValueM } from '../helpers/poolHelperMaya'
import { userChains$ } from '../services/storage/userChains'

/**
 * Chain balances which count towards totals: enabled chains only, and never chains which are not real balances
 * (XMR: view-only "received", see `isExcludedFromTotals`).
 */
export const filterChainBalancesForTotals = <T extends { chain: string }>(
  chainBalances: ReadonlyArray<T>,
  enabledChains: ReadonlyArray<string>
): T[] =>
  chainBalances.filter(
    (chainBalance) =>
      enabledChains.includes(chainBalance.chain as EnabledChain) && !isExcludedFromTotals(chainBalance.chain)
  )

export const useTotalWalletBalance = () => {
  const { chainBalances$ } = useWalletContext()

  const {
    service: {
      pools: { poolsState$, selectedPricePool$ }
    }
  } = useMidgardContext()

  const {
    service: {
      pools: { poolsState$: mayaPoolsState$, selectedPricePool$: mayaSelectedPricePool$ }
    }
  } = useMidgardMayaContext()

  // Observable to capture both the calculated balances and errors
  const combinedBalances$ = Rx.combineLatest([
    chainBalances$,
    poolsState$,
    userChains$,
    selectedPricePool$,
    mayaPoolsState$,
    mayaSelectedPricePool$
  ]).pipe(
    RxOp.map(([chainBalances, poolsStateRD, chains, selectedPricePool, poolsStateMayaRD, selectedPricePoolMaya]) => {
      const balancesByChain: Record<string, BaseAmount> = {}
      const errorsByChain: Record<string, string> = {}

      filterChainBalancesForTotals(chainBalances, chains).forEach((chainBalance) => {
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
                // Accumulate instead of assigning — BTC Ledger can emit two ChainBalances
                // (Native SegWit + Taproot) that share the same chain:walletType key.
                const key = `${chainBalance.chain}:${chainBalance.walletType}`
                balancesByChain[key] = (balancesByChain[key] ?? ZERO_BASE_AMOUNT).plus(totalForChain)
              }
            )
          )
        }
      })

      return { chainBalances, balancesByChain, errorsByChain }
    })
  )

  return combinedBalances$
}
