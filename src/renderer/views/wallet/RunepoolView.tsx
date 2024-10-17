import React, { useCallback, useEffect, useMemo, useState } from 'react'

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
import { Row } from 'antd'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletType } from '../../../shared/wallet/types'
import { RunePoolTable } from '../../components/runePool/runePoolTable'
import { RefreshButton } from '../../components/uielements/button'
import { AssetsNav } from '../../components/wallet/assets'
import * as Styled from '../../components/wallet/assets/TotalValue.styles'
import { DEFAULT_WALLET_TYPE } from '../../const'
import { useChainContext } from '../../contexts/ChainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import { isUSDAsset } from '../../helpers/assetHelper'
import { isThorChain } from '../../helpers/chainHelper'
import { sequenceTRD } from '../../helpers/fpHelpers'
import * as PoolHelpers from '../../helpers/poolHelper'
import { hiddenString } from '../../helpers/stringHelper'
import { filterWalletBalancesByAssets, getWalletBalanceByAssetAndWalletType } from '../../helpers/walletHelper'
import { useNetwork } from '../../hooks/useNetwork'
import { usePricePool } from '../../hooks/usePricePool'
import { WalletBalances } from '../../services/clients'
import { userChains$ } from '../../services/storage/userChains'
import { RunePoolProviderRD } from '../../services/thorchain/types'
import { balancesState$, setSelectedAsset } from '../../services/wallet'
import { DEFAULT_BALANCES_FILTER, INITIAL_BALANCES_STATE } from '../../services/wallet/const'
import { WalletBalance } from '../../services/wallet/types'
import { ledgerAddressToWalletAddress } from '../../services/wallet/util'
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

export const RunepoolView: React.FC = (): JSX.Element => {
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

  const [allRunePoolProviders, setAllRunePoolProviders] = useState<Record<string, RunePoolProviderRD>>({})
  const [assetDetailsArray, setAssetDetailsArray] = useState<AssetProps[]>([])

  useEffect(() => {
    const userChainsSubscription = userChains$.subscribe((enabledChains) => {
      // Keystore addresses
      const keystoreAddresses$ = FP.pipe(
        enabledChains,
        A.filter((chain) => isThorChain(chain)),
        A.map(addressByChain$)
      )

      // Ledger addresses
      const ledgerAddresses$ = FP.pipe(
        enabledChains,
        A.filter((chain) => isThorChain(chain)),
        A.map((chain) => getLedgerAddress$(chain)),
        A.map(RxOp.map(FP.flow(O.map(ledgerAddressToWalletAddress))))
      )

      const combinedAddresses$ = Rx.combineLatest([...keystoreAddresses$, ...ledgerAddresses$]).pipe(
        RxOp.map((addressOptionsArray) => FP.pipe(addressOptionsArray, A.filterMap(FP.identity))),
        RxOp.map((walletAddresses) =>
          walletAddresses.map((walletAddress) => ({
            address: walletAddress.address,
            type: walletAddress.type
          }))
        )
      )

      const subscriptions = combinedAddresses$
        .pipe(
          RxOp.switchMap((walletAddresses) => {
            if (walletAddresses.length > 0) {
              return Rx.combineLatest(
                walletAddresses.map((walletAddress) => getRunePoolProvider$(walletAddress.address, walletAddress.type))
              )
            }
            return Rx.of(null)
          })
        )
        .subscribe((runePoolProviders) => {
          if (runePoolProviders) {
            runePoolProviders.forEach((provider) => {
              if (provider && provider._tag === 'RemoteSuccess' && provider.value.depositAmount.amount().gt(0)) {
                const key = `${provider.value.address}.${provider.value.walletType}`
                setAllRunePoolProviders((prev) => ({ ...prev, [key]: provider }))
              }
            })
          }
        })

      return () => {
        subscriptions.unsubscribe()
        userChainsSubscription.unsubscribe()
      }
    })
  }, [addressByChain$, getLedgerAddress$, getRunePoolProvider$])

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
      <Styled.Container>
        <Styled.TitleContainer>
          <Styled.BalanceTitle>{intl.formatMessage({ id: 'wallet.shares.total' })}</Styled.BalanceTitle>
        </Styled.TitleContainer>
        <Styled.BalanceLabel>{isPrivate ? hiddenString : totalRedeemPrice}</Styled.BalanceLabel>
      </Styled.Container>
    )
  }, [intl, isPrivate, totalRedeemPrice])

  const refreshHandler = useCallback(() => {
    reloadAllPools()
    reloadRunePoolProvider()
  }, [reloadAllPools, reloadRunePoolProvider])
  return (
    <div>
      <Row justify="end" style={{ marginBottom: '20px' }}>
        <RefreshButton onClick={refreshHandler} disabled={false} />
      </Row>
      <AssetsNav />
      {renderRunePoolTotal}
      <RunePoolTable assetDetails={assetDetailsArray} />
    </div>
  )
}
