import * as RD from '@devexperts/remote-data-ts'
import { BaseAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ZERO_BASE_AMOUNT } from '../const'
import { useMidgardContext } from '../contexts/MidgardContext'
import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import { useWalletContext } from '../contexts/WalletContext'
import { to1e8BaseAmount } from '../helpers/assetHelper'
import { getPoolPriceValue } from '../helpers/poolHelper'
import { getPoolPriceValue as getPoolPriceValueM } from '../helpers/poolHelperMaya'

interface BalancesAndErrors {
  balancesByChain: Record<string, BaseAmount>
  errorsByChain: Record<string, string>
}

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
  const balancesAndErrors$ = Rx.combineLatest([
    chainBalances$,
    poolsState$,
    selectedPricePool$,
    mayaPoolsState$,
    mayaSelectedPricePool$
  ]).pipe(
    RxOp.map(([chainBalances, poolsStateRD, selectedPricePool, poolsStateMayaRD, selectedPricePoolMaya]) => {
      // Initialize a structure to hold successful balances and errors
      const balancesByChain: Record<string, BaseAmount> = {}
      const errorsByChain: Record<string, string> = {}

      // Process each chain balance
      chainBalances.forEach((chainBalance) => {
        if (chainBalance.balancesType === 'all') {
          FP.pipe(
            chainBalance.balances,
            RD.fold(
              () => {}, // Ignore initial/loading states
              () => {},
              (error) => {
                // Capture errors specific to each chain
                errorsByChain[chainBalance.chain] = `${error.msg} (errorId: ${error.errorId})`
              },
              (walletBalances) => {
                // Calculate the total balance for the chain
                const totalForChain = walletBalances.reduce((acc, { asset, amount }) => {
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
                  return acc.plus(to1e8BaseAmount(O.getOrElse(() => ZERO_BASE_AMOUNT)(value)))
                }, ZERO_BASE_AMOUNT)
                balancesByChain[`${chainBalance.chain}:${chainBalance.walletType}`] = totalForChain
              }
            )
          )
        }
      })

      return { balancesByChain, errorsByChain }
    })
  )

  const balancesAndErrors: BalancesAndErrors = useObservableState(balancesAndErrors$, {
    balancesByChain: {},
    errorsByChain: {}
  })

  return balancesAndErrors
}
