import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import {
  Asset,
  BaseAmount,
  baseAmount,
  Chain,
  formatAssetAmountCurrency,
  baseToAsset,
  bnOrZero
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { WalletType } from '../../../shared/wallet/types'
import { ProtocolPoolTable } from '../../components/runePool/runePoolTable'
import { RefreshButton } from '../../components/uielements/button'
import { Label } from '../../components/uielements/label'
import { AssetsNav } from '../../components/wallet/assets'
import { DEFAULT_WALLET_TYPE } from '../../const'
import { useChainContext } from '../../contexts/ChainContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { sequenceTRD } from '../../helpers/fpHelpers'
import * as PoolHelpers from '../../helpers/poolHelper'
import * as PoolHelpersMaya from '../../helpers/poolHelperMaya'
import { hiddenString } from '../../helpers/stringHelper'
import { filterWalletBalancesByAssets } from '../../helpers/walletHelper'
import { useCacaoPoolProviders } from '../../hooks/useAllCacaoPoolProviders'
import { useRunePoolProviders } from '../../hooks/useAllRunePoolProviders'
import { useNetwork } from '../../hooks/useNetwork'
import { usePricePool } from '../../hooks/usePricePool'
import { usePricePoolMaya } from '../../hooks/usePricePoolMaya'
import { WalletBalances } from '../../services/clients'
import { userChains$ } from '../../services/storage/userChains'
import { balancesState$ } from '../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../services/wallet/const'
import { useApp } from '../../store/app/hooks'

type AssetProps = {
  key: Chain
  asset: Asset
  priceAsset: Asset
  value: BaseAmount
  deposit: { amount: BaseAmount; price: BaseAmount }
  withdraw: { amount: BaseAmount; price: BaseAmount }
  percent: BigNumber
  network: Network
  walletType: WalletType
  privateData: boolean
  chain: Chain // Added to distinguish between THOR and MAYA
}

export type ParentProps = {
  assetDetails: AssetProps[]
  allBalances: WalletBalances
}

export const ProtocolPoolView = (): JSX.Element => {
  const intl = useIntl()
  const { isPrivate } = useApp()
  const { network } = useNetwork()

  // Thor contexts
  const {
    service: {
      pools: { poolsState$: thorPoolsState$, reloadAllPools: reloadThorPools }
    }
  } = useMidgardContext()

  // Maya contexts
  const {
    service: {
      pools: { poolsState$: mayaPoolsState$, reloadAllPools: reloadMayaPools }
    }
  } = useMidgardMayaContext()

  const { addressByChain$ } = useChainContext()
  const { getLedgerAddress$ } = useWalletContext()

  const [{ balances: oBalances }] = useObservableState(
    () => balancesState$(DEFAULT_BALANCES_FILTER),
    INITIAL_BALANCES_STATE
  )

  const allBalances: WalletBalances = useMemo(
    () =>
      FP.pipe(
        oBalances,
        O.map((balances) => filterWalletBalancesByAssets(balances, [AssetRuneNative, AssetCacao])),
        O.getOrElse<WalletBalances>(() => [])
      ),
    [oBalances]
  )

  // Thor pool providers
  const { getRunePoolProvider$, reloadRunePoolProvider } = useThorchainContext()
  const thorPricePool = usePricePool()
  const thorPoolsStateRD = useObservableState(thorPoolsState$, RD.initial)

  const allRunePoolProviders = useRunePoolProviders(
    userChains$,
    addressByChain$,
    getLedgerAddress$,
    getRunePoolProvider$
  )

  // Maya pool providers
  const { getCacaoPoolProvider$, reloadCacaoPoolProvider } = useMayachainContext()
  const mayaPricePool = usePricePoolMaya()
  const mayaPoolsStateRD = useObservableState(mayaPoolsState$, RD.initial)

  const allCacaoPoolProviders = useCacaoPoolProviders(
    userChains$,
    addressByChain$,
    getLedgerAddress$,
    getCacaoPoolProvider$
  )

  const [assetDetailsArray, setAssetDetailsArray] = useState<AssetProps[]>([])

  useEffect(() => {
    const assetDetails: AssetProps[] = []

    // Process RUNE pool providers
    Object.keys(allRunePoolProviders).forEach((assetString) => {
      const runePoolProviderRD = allRunePoolProviders[assetString]
      const result = FP.pipe(
        sequenceTRD(thorPoolsStateRD, runePoolProviderRD),
        RD.fold(
          () => null,
          () => null,
          (_) => null,
          ([{ poolDetails }, { value, depositAmount, withdrawAmount, pnl, walletType = DEFAULT_WALLET_TYPE }]) => {
            if (depositAmount.amount().isZero() || value.amount().isZero()) {
              return null
            }
            const asset = AssetRuneNative
            const depositPrice = FP.pipe(
              PoolHelpers.getPoolPriceValue({
                balance: { asset, amount: depositAmount },
                poolDetails,
                pricePool: thorPricePool
              }),
              O.getOrElse(() => baseAmount(0, depositAmount.decimal))
            )
            const withdrawPrice = FP.pipe(
              PoolHelpers.getPoolPriceValue({
                balance: { asset, amount: withdrawAmount },
                poolDetails,
                pricePool: thorPricePool
              }),
              O.getOrElse(() => baseAmount(0, withdrawAmount.decimal))
            )
            const percent = bnOrZero(pnl.div(depositAmount).times(100).amount().toNumber())
            return {
              key: thorPricePool.asset.chain,
              asset,
              value,
              priceAsset: thorPricePool.asset as Asset,
              deposit: { amount: depositAmount, price: depositPrice },
              withdraw: { amount: withdrawAmount, price: withdrawPrice },
              percent,
              network,
              walletType,
              privateData: isPrivate,
              chain: 'THOR' as Chain
            }
          }
        )
      )
      if (result) assetDetails.push(result)
    })

    // Process CACAO pool providers
    Object.keys(allCacaoPoolProviders).forEach((assetString) => {
      const cacaoPoolProviderRD = allCacaoPoolProviders[assetString]
      const result = FP.pipe(
        sequenceTRD(mayaPoolsStateRD, cacaoPoolProviderRD),
        RD.fold(
          () => null,
          () => null,
          (_) => null,
          ([{ poolDetails }, { value, depositAmount, withdrawAmount, pnl, walletType = DEFAULT_WALLET_TYPE }]) => {
            if (depositAmount.amount().isZero() || value.amount().isZero()) {
              return null
            }
            const asset = AssetCacao
            const depositPrice = FP.pipe(
              PoolHelpersMaya.getUSDValue({
                balance: { asset, amount: depositAmount },
                poolDetails,
                pricePool: mayaPricePool
              }),
              O.getOrElse(() => baseAmount(0, depositAmount.decimal))
            )
            const withdrawPrice = FP.pipe(
              PoolHelpersMaya.getUSDValue({
                balance: { asset, amount: withdrawAmount },
                poolDetails,
                pricePool: mayaPricePool
              }),
              O.getOrElse(() => baseAmount(0, withdrawAmount.decimal))
            )
            const percent = bnOrZero(pnl.div(depositAmount).times(100).amount().toNumber())
            return {
              key: mayaPricePool.asset.chain,
              asset,
              value,
              priceAsset: mayaPricePool.asset as Asset,
              deposit: { amount: depositAmount, price: depositPrice },
              withdraw: { amount: withdrawAmount, price: withdrawPrice },
              percent,
              network,
              walletType,
              privateData: isPrivate,
              chain: 'MAYA' as Chain
            }
          }
        )
      )
      if (result) assetDetails.push(result)
    })

    setAssetDetailsArray(assetDetails)
  }, [
    allRunePoolProviders,
    allCacaoPoolProviders,
    isPrivate,
    network,
    thorPoolsStateRD,
    mayaPoolsStateRD,
    thorPricePool,
    mayaPricePool
  ])

  const totalRedeemPrice = useMemo(() => {
    // Sum the USD/price values as regular numbers
    const totalUSDValue = assetDetailsArray.reduce((acc, item) => {
      // Convert BaseAmount to regular number for USD value
      const itemUSDValue = baseToAsset(item.deposit.price).amount().toNumber()
      return acc + itemUSDValue
    }, 0)

    // Format the total using Thor price pool asset (typically USD)
    const formattedTotal = formatAssetAmountCurrency({
      amount: baseToAsset(baseAmount(Math.round(totalUSDValue * 100), 2)), // Convert to cents then back
      asset: thorPricePool.asset,
      decimal: 2 // Use 2 decimal places for USD display
    })

    return formattedTotal
  }, [assetDetailsArray, thorPricePool])

  const renderProtocolPoolTotal = useMemo(() => {
    return (
      <div className="flex flex-col items-center justify-center bg-bg1 px-4 pb-8 pt-4 dark:bg-bg1d">
        <Label className="!w-auto" align="center" color="input" textTransform="uppercase">
          {intl.formatMessage({ id: 'wallet.shares.total' })}
        </Label>
        <Label className="mx-10px mt-4 text-[28px]" align="center" color="gray">
          {isPrivate ? hiddenString : totalRedeemPrice}
        </Label>
      </div>
    )
  }, [intl, isPrivate, totalRedeemPrice])

  const refreshHandler = useCallback(() => {
    reloadThorPools()
    reloadMayaPools()
    reloadRunePoolProvider()
    reloadCacaoPoolProvider()
  }, [reloadThorPools, reloadMayaPools, reloadRunePoolProvider, reloadCacaoPoolProvider])

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <RefreshButton onClick={refreshHandler} disabled={false} />
      </div>
      <AssetsNav />
      {renderProtocolPoolTotal}
      <div className="bg-bg1 p-2 dark:bg-bg1d">
        <ProtocolPoolTable assetDetails={assetDetailsArray} allBalances={allBalances} />
      </div>
    </div>
  )
}
