import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import {
  Asset,
  BaseAmount,
  baseAmount,
  Chain,
  formatAssetAmountCurrency,
  baseToAsset,
  assetAmount,
  bnOrZero
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { function as FP, nonEmptyArray as NEA, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { WalletType } from '../../../shared/wallet/types'
import { RunePoolTable } from '../../components/runePool/runePoolTable'
import { RefreshButton } from '../../components/uielements/button'
import { Label } from '../../components/uielements/label'
import { AssetsNav } from '../../components/wallet/assets'
import { DEFAULT_WALLET_TYPE } from '../../const'
import { useChainContext } from '../../contexts/ChainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { isUSDAsset } from '../../helpers/assetHelper'
import { sequenceTRD } from '../../helpers/fpHelpers'
import * as PoolHelpers from '../../helpers/poolHelper'
import { hiddenString } from '../../helpers/stringHelper'
import { filterWalletBalancesByAssets, getWalletBalanceByAssetAndWalletType } from '../../helpers/walletHelper'
import { useRunePoolProviders } from '../../hooks/useAllRunePoolProviders'
import { useNetwork } from '../../hooks/useNetwork'
import { usePricePool } from '../../hooks/usePricePool'
import { WalletBalances } from '../../services/clients'
import { userChains$ } from '../../services/storage/userChains'
import { balancesState$, setSelectedAsset } from '../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../services/wallet/const'
import { WalletBalance } from '../../services/wallet/types'
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
}
export type ParentProps = {
  assetDetails: AssetProps[]
}

export const RunepoolView = (): JSX.Element => {
  const intl = useIntl()

  const { isPrivate } = useApp()

  const { network } = useNetwork()
  const {
    service: {
      pools: { poolsState$, reloadAllPools }
    }
  } = useMidgardContext()
  const asset = AssetRuneNative
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
        // filter wallet balances to include assets available to swap only including synth balances
        O.map((balances) => filterWalletBalancesByAssets(balances, [AssetRuneNative])),
        O.getOrElse<WalletBalances>(() => [])
      ),
    [oBalances]
  )

  const { getRunePoolProvider$, reloadRunePoolProvider } = useThorchainContext()
  const pricePool = usePricePool()
  const poolsStateRD = useObservableState(poolsState$, RD.initial)

  const [assetDetailsArray, setAssetDetailsArray] = useState<AssetProps[]>([])

  const allRunePoolProviders = useRunePoolProviders(
    userChains$,
    addressByChain$,
    getLedgerAddress$,
    getRunePoolProvider$
  )

  const oSourceAssetWB: O.Option<WalletBalance> = useMemo(() => {
    const oWalletBalances = NEA.fromArray(allBalances)
    const firstKey = Object.keys(allRunePoolProviders)[0]
    const walletType = firstKey ? (firstKey.split('.')[1] as WalletType) : DEFAULT_WALLET_TYPE

    return getWalletBalanceByAssetAndWalletType({
      oWalletBalances,
      asset: AssetRuneNative,
      walletType
    })
  }, [allBalances, allRunePoolProviders])
  useEffect(() => {
    setSelectedAsset(oSourceAssetWB)
  }, [oSourceAssetWB])

  useEffect(() => {
    const assetDetails: AssetProps[] = Object.keys(allRunePoolProviders)
      .map((assetString) => {
        const runePoolProviderRD = allRunePoolProviders[assetString]
        return FP.pipe(
          sequenceTRD(poolsStateRD, runePoolProviderRD),
          RD.fold(
            () => null,
            () => null,
            (_) => null,
            ([{ poolDetails }, { value, depositAmount, withdrawAmount, pnl, walletType }]) => {
              if (depositAmount.amount().isZero()) {
                return null
              }
              const depositPrice = FP.pipe(
                PoolHelpers.getPoolPriceValue({
                  balance: { asset, amount: depositAmount },
                  poolDetails,
                  pricePool
                }),
                O.getOrElse(() => baseAmount(0, depositAmount.decimal))
              )
              const withdrawPrice = FP.pipe(
                PoolHelpers.getPoolPriceValue({
                  balance: { asset, amount: withdrawAmount },
                  poolDetails,
                  pricePool
                }),
                O.getOrElse(() => baseAmount(0, withdrawAmount.decimal))
              )
              const percent = bnOrZero(pnl.div(depositAmount).times(100).amount().toNumber())
              return {
                key: pricePool.asset.chain,
                asset,
                value,
                priceAsset: pricePool.asset,
                deposit: { amount: depositAmount, price: depositPrice },
                withdraw: { amount: withdrawAmount, price: withdrawPrice },
                percent,
                walletType,
                privateData: isPrivate
              }
            }
          )
        )
      })
      .filter((item): item is AssetProps => item !== null)

    setAssetDetailsArray(assetDetails)
  }, [allRunePoolProviders, asset, isPrivate, network, poolsStateRD, pricePool])

  const totalRedeemPrice = useMemo(() => {
    const sum = assetDetailsArray.reduce((acc, item) => {
      return acc + baseToAsset(item.value).amount().toNumber()
    }, 0)
    const formattedTotal = formatAssetAmountCurrency({
      amount: assetAmount(sum),
      asset: pricePool.asset,
      decimal: isUSDAsset(pricePool.asset) ? 2 : 6
    })

    return formattedTotal
  }, [assetDetailsArray, pricePool])

  const renderRunePoolTotal = useMemo(() => {
    return (
      <div className="flex flex-col items-center justify-center bg-bg1 dark:bg-bg1d px-4 pt-4 pb-8">
        <Label className="!w-auto" align="center" color="input" textTransform="uppercase">
          {intl.formatMessage({ id: 'wallet.shares.total' })}
        </Label>
        <Label className="mt-4 mx-10px text-[28px]" align="center" color="gray">
          {isPrivate ? hiddenString : totalRedeemPrice}
        </Label>
      </div>
    )
  }, [intl, isPrivate, totalRedeemPrice])

  const refreshHandler = useCallback(() => {
    reloadAllPools()
    reloadRunePoolProvider()
  }, [reloadAllPools, reloadRunePoolProvider])
  return (
    <div>
      <div className="flex justify-end mb-5">
        <RefreshButton onClick={refreshHandler} disabled={false} />
      </div>
      <AssetsNav />
      {renderRunePoolTotal}
      <RunePoolTable assetDetails={assetDetailsArray} />
    </div>
  )
}
