import React, { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { Asset, assetFromStringEx, BaseAmount, baseAmount, Chain } from '@xchainjs/xchain-util'
import { Row } from 'antd'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { WalletType } from '../../../shared/wallet/types'
import { SaversDetailsTable } from '../../components/savers/SaversDetailsTable'
import { RefreshButton } from '../../components/uielements/button'
import { AssetsNav, TotalAssetValue } from '../../components/wallet/assets'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { sequenceTRD } from '../../helpers/fpHelpers'
import * as PoolHelpers from '../../helpers/poolHelper'
import { useAllSaverProviders } from '../../hooks/useAllSaverProviders'
import { usePricePool } from '../../hooks/usePricePool'
import { useApp } from '../../store/app/hooks'

type AssetProps = {
  key: Chain
  asset: Asset
  priceAsset: Asset
  deposit: { amount: BaseAmount; price: BaseAmount }
  redeem: { amount: BaseAmount; price: BaseAmount }
  percent: BigNumber
  network: Network
  walletType: WalletType
  privateData: boolean
}
export type ParentProps = {
  assetDetails: AssetProps[]
}

export const SaversDetailsView: React.FC = (): JSX.Element => {
  const intl = useIntl()

  const { isPrivate } = useApp()

  const {
    service: {
      pools: { poolsState$, reloadAllPools }
    }
  } = useMidgardContext()

  const { reloadSaverProvider } = useThorchainContext()
  const pricePool = usePricePool()
  const poolsStateRD = useObservableState(poolsState$, RD.initial)

  const poolSavers = useMemo(
    () =>
      FP.pipe(
        sequenceTRD(poolsStateRD),
        RD.fold(
          () => null,
          () => null,
          (error) => {
            console.error('An error occurred:', error)
            return null
          },
          ([poolsState]) => {
            const poolDetailsFiltered: PoolDetails = FP.pipe(
              poolsState.poolDetails,
              A.filter(({ saversDepth }) => Number(saversDepth) > 0)
            )
            return poolDetailsFiltered // replace this with what you actually want to return
          }
        )
      ),
    [poolsStateRD]
  )

  const poolAsset = useMemo(() => {
    return poolSavers ? poolSavers.map((detail) => assetFromStringEx(detail.asset)) : []
  }, [poolSavers])

  const { allSaverProviders } = useAllSaverProviders(poolAsset)

  const assetDetailsArray = useMemo(() => {
    return Object.keys(allSaverProviders)
      .map((assetString) => {
        const saverProviderRD = allSaverProviders[assetString]
        return FP.pipe(
          sequenceTRD(poolsStateRD, saverProviderRD),
          RD.fold(
            () => null,
            () => null,
            (_) => null,
            ([{ poolDetails }, { depositValue, redeemValue, growthPercent, walletType }]) => {
              if (depositValue.amount().isZero() && redeemValue.amount().isZero()) {
                return null
              }
              const asset = assetFromStringEx(assetString)
              if (asset === null) return null

              const depositPrice = FP.pipe(
                PoolHelpers.getPoolPriceValue({
                  balance: { asset, amount: depositValue },
                  poolDetails,
                  pricePool
                }),
                O.getOrElse(() => baseAmount(0, depositValue.decimal))
              )
              const redeemPrice = FP.pipe(
                PoolHelpers.getPoolPriceValue({
                  balance: { asset, amount: redeemValue },
                  poolDetails,
                  pricePool
                }),
                O.getOrElse(() => baseAmount(0, depositValue.decimal))
              )
              return {
                key: pricePool.asset.chain,
                asset,
                priceAsset: pricePool.asset,
                deposit: { amount: depositValue, price: depositPrice },
                redeem: { amount: redeemValue, price: redeemPrice },
                percent: growthPercent.times(100),
                walletType,
                privateData: isPrivate
              }
            }
          )
        )
      })
      .filter((item): item is AssetProps => item !== null)
  }, [allSaverProviders, isPrivate, poolsStateRD, pricePool])

  const saversByChain = useMemo(() => {
    let saversDetails = {}

    assetDetailsArray.forEach((item) => {
      saversDetails = {
        ...saversDetails,
        [`${item.asset.chain}:${item.walletType}`]: item.redeem.price
      }
    })

    return saversDetails
  }, [assetDetailsArray])

  const refreshHandler = useCallback(() => {
    reloadAllPools()
    reloadSaverProvider()
  }, [reloadAllPools, reloadSaverProvider])

  return (
    <div>
      <Row justify="end" style={{ marginBottom: '20px' }}>
        <RefreshButton onClick={refreshHandler} disabled={false} />
      </Row>
      <AssetsNav />
      <TotalAssetValue
        balancesByChain={saversByChain}
        errorsByChain={{}}
        title={intl.formatMessage({ id: 'wallet.shares.total' })}
        hidePrivateData={isPrivate}
      />
      <SaversDetailsTable assetDetails={assetDetailsArray} />
    </div>
  )
}
