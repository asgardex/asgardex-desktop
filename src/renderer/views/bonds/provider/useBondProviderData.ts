import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, BaseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { ZERO_BASE_AMOUNT } from '../../../const'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { isRuneNativeAsset, isUSDAsset } from '../../../helpers/assetHelper'
import { RUNE_PRICE_POOL } from '../../../helpers/poolHelper'
import { useBondProviderPositions } from '../../../hooks/useBondProviderPositions'
import { useNetwork } from '../../../hooks/useNetwork'
import { PricePool } from '../../../services/midgard/midgardTypes'
import { reloadBalancesByChain } from '../../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../../services/wallet/const'
import { WalletBalances } from '../../../services/wallet/types'
import { getValueOfRuneInAsset } from '../../pools/Pools.utils'
import { BondWalletInfo } from '../types'

export const useBondProviderData = () => {
  const { network } = useNetwork()
  const { getNodeInfos$, reloadNodeInfos } = useThorchainContext()
  const { balancesState$ } = useWalletContext()
  const {
    service: {
      networkInfo$,
      pools: { poolsState$, selectedPricePool$ }
    }
  } = useMidgardContext()

  const [{ balances: oBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )

  const networkInfoRD = useObservableState(networkInfo$, RD.initial)
  const poolsRD = useObservableState(poolsState$, RD.initial)
  const selectedPricePool = useObservableState(selectedPricePool$, RUNE_PRICE_POOL)

  // Price pool used for the "≈ <price>" subtitles. Bonds are denominated in
  // RUNE, so pricing them in the RUNE pool would just repeat the same figure —
  // fall back to the USD pool in that case (and show no price if there is none).
  const oPricePool: O.Option<PricePool> = useMemo(() => {
    if (!isRuneNativeAsset(selectedPricePool.asset)) return O.some(selectedPricePool)
    return FP.pipe(
      poolsRD,
      RD.toOption,
      O.chain(({ pricePools }) => pricePools),
      O.chain((pricePools) => O.fromNullable(pricePools.find(({ asset }) => isUSDAsset(asset))))
    )
  }, [poolsRD, selectedPricePool])

  const runeBalances: WalletBalances = useMemo(
    () =>
      FP.pipe(
        oBalances,
        O.map((balances) => balances.filter(({ asset }) => asset.chain === THORChain && isRuneNativeAsset(asset))),
        O.getOrElse<WalletBalances>(() => [])
      ),
    [oBalances]
  )

  const walletInfos: BondWalletInfo[] = useMemo(
    () =>
      runeBalances.map(({ walletAddress, walletType, walletAccount, walletIndex, hdMode }) => ({
        address: walletAddress,
        walletType,
        walletAccount,
        walletIndex,
        hdMode
      })),
    [runeBalances]
  )

  const addressesFetched = walletInfos.length > 0

  // The wallet can expose THOR addresses from more than one source at a time
  // (keystore + ledger). When it does, every position has to say which one it
  // signs with — an unlabelled card would be read as the keystore one.
  const hasMultipleWalletTypes = useMemo(
    () => new Set(walletInfos.map(({ walletType }) => walletType)).size > 1,
    [walletInfos]
  )

  const freeToBond: BaseAmount = useMemo(
    () => runeBalances.reduce((acc, { amount }) => acc.plus(amount), ZERO_BASE_AMOUNT),
    [runeBalances]
  )

  const balanceByAddress = useCallback(
    (address: Address): BaseAmount =>
      FP.pipe(
        runeBalances.find(({ walletAddress }) => walletAddress.toLowerCase() === address.toLowerCase()),
        O.fromNullable,
        O.map(({ amount }) => amount),
        O.getOrElse(() => ZERO_BASE_AMOUNT)
      ),
    [runeBalances]
  )

  const positionsRD = useBondProviderPositions({
    addressesFetched,
    thorWalletAddresses: walletInfos,
    getNodeInfos$
  })

  // network-wide bonding APR from Midgard, e.g. "21.4% APR"
  const aprLabel: O.Option<string> = useMemo(
    () =>
      FP.pipe(
        networkInfoRD,
        RD.toOption,
        O.chain(({ bondingAPY }) => {
          const apy = parseFloat(bondingAPY)
          return Number.isFinite(apy) ? O.some(`${(apy * 100).toFixed(1)}% APR`) : O.none
        })
      ),
    [networkInfoRD]
  )

  const formatPrice = useCallback(
    (runeAmount: BaseAmount): O.Option<string> =>
      FP.pipe(
        oPricePool,
        O.map(({ asset, poolData }) =>
          formatAssetAmountCurrency({
            amount: baseToAsset(getValueOfRuneInAsset(runeAmount, poolData)),
            asset,
            decimal: isUSDAsset(asset) ? 0 : 2
          })
        )
      ),
    [oPricePool]
  )

  const reload = useCallback(() => {
    reloadNodeInfos()
    const walletTypes = Array.from(new Set(walletInfos.map(({ walletType }) => walletType)))
    walletTypes.forEach((walletType) => reloadBalancesByChain(THORChain, walletType)())
  }, [reloadNodeInfos, walletInfos])

  return {
    network,
    walletInfos,
    hasMultipleWalletTypes,
    addressesFetched,
    freeToBond,
    balanceByAddress,
    positionsRD,
    aprLabel,
    formatPrice,
    reload
  }
}
