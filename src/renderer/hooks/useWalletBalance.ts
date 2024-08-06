import * as RD from '@devexperts/remote-data-ts'
import { BaseAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { EnabledChain } from '../../shared/utils/chain'
import { ZERO_BASE_AMOUNT } from '../const'
import { useMidgardContext } from '../contexts/MidgardContext'
import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import { useWalletContext } from '../contexts/WalletContext'
import { to1e8BaseAmount } from '../helpers/assetHelper'
import { getPoolPriceValue } from '../helpers/poolHelper'
import { getPoolPriceValue as getPoolPriceValueM } from '../helpers/poolHelperMaya'
import { userChains$ } from '../services/storage/userChains'

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

      chainBalances
        .filter((chainBalance) => chains.includes(chainBalance.chain as EnabledChain))
        .forEach((chainBalance) => {
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

  return combinedBalances$
}
