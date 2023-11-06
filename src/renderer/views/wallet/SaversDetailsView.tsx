import React, { useCallback, useEffect, useMemo, useState } from 'react'

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
import { from } from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { SaversDetailsTable } from '../../components/savers/SaversDetailsTable'
import { RefreshButton } from '../../components/uielements/button'
import { AssetsNav } from '../../components/wallet/assets'
import { useChainContext } from '../../contexts/ChainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { sequenceTRD } from '../../helpers/fpHelpers'
import * as PoolHelpers from '../../helpers/poolHelper'
import { addressFromOptionalWalletAddress } from '../../helpers/walletHelper'
import { useNetwork } from '../../hooks/useNetwork'
import { usePricePool } from '../../hooks/usePricePool'
import { SaverProviderRD } from '../../services/thorchain/types'

type AssetProps = {
  key: Chain
  asset: Asset
  priceAsset: Asset
  deposit: { amount: BaseAmount; price: BaseAmount }
  redeem: { amount: BaseAmount; price: BaseAmount }
  percent: BigNumber
  network: Network
}
export type ParentProps = {
  assetDetails: AssetProps[]
}

export const SaversDetailsView: React.FC = (): JSX.Element => {
  //const intl = useIntl()

  const { network } = useNetwork()
  const {
    service: {
      pools: { poolsState$, reloadAllPools }
    }
  } = useMidgardContext()
  const { addressByChain$ } = useChainContext()
  const { getSaverProvider$, reloadSaverProvider } = useThorchainContext()
  const pricePool = usePricePool()
  const poolsStateRD = useObservableState(poolsState$, RD.initial)

  const [allSaverProviders, setAllSaverProviders] = useState<Record<string, SaverProviderRD>>({})
  const [assetDetailsArray, setAssetDetailsArray] = useState<AssetProps[]>([])

  const poolSavers = useMemo(
    () =>
      FP.pipe(
        sequenceTRD(poolsStateRD),
        RD.fold(
          // initial state
          () => null,

          // loading state
          () => null,

          // error state
          (error) => {
            console.error('An error occurred:', error)
            return null
          },

          // success state
          ([poolsState]) => {
            // const { poolDetails }: PoolsState = pools
            // filter chain assets

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

  useEffect(() => {
    // If poolAsset is Some, destructure and use its value
    if (poolAsset) {
      const subscriptions = poolAsset.map((asset) => {
        return addressByChain$(asset.chain)
          .pipe(
            RxOp.map(addressFromOptionalWalletAddress),
            RxOp.switchMap((addressOpt) => {
              if (O.isSome(addressOpt)) {
                const address = addressOpt.value
                return getSaverProvider$(asset, address)
              }
              return from([null])
            })
          )
          .subscribe((saverProvider) => {
            if (
              saverProvider !== null &&
              saverProvider._tag === 'RemoteSuccess' &&
              saverProvider.value.depositValue.amount().gt(0)
            ) {
              setAllSaverProviders((prev) => ({ ...prev, [`${asset.chain}.${asset.symbol}`]: saverProvider }))
            }
          })
      })

      return () => {
        subscriptions.forEach((sub) => sub.unsubscribe())
      }
    }
  }, [addressByChain$, getSaverProvider$, poolAsset])

  useEffect(() => {
    const assetDetails: AssetProps[] = Object.keys(allSaverProviders)
      .map((assetString) => {
        const saverProviderRD = allSaverProviders[assetString]

        return FP.pipe(
          sequenceTRD(poolsStateRD, saverProviderRD),
          RD.fold(
            () => null,
            () => null,
            (_) => null,
            ([{ poolDetails }, { depositValue, redeemValue, growthPercent }]) => {
              if (depositValue.amount().isZero() && redeemValue.amount().isZero()) {
                return null
              }

              const asset = assetFromStringEx(assetString) // get the second string to return asset
              if (asset === null) {
                // handle error case
                return null
              }
              const depositPrice = FP.pipe(
                PoolHelpers.getPoolPriceValue({
                  balance: { asset, amount: depositValue },
                  poolDetails,
                  pricePool,
                  network
                }),
                O.getOrElse(() => baseAmount(0, depositValue.decimal))
              )
              const redeemPrice = FP.pipe(
                PoolHelpers.getPoolPriceValue({
                  balance: { asset, amount: redeemValue },
                  poolDetails,
                  pricePool,
                  network
                }),
                O.getOrElse(() => baseAmount(0, depositValue.decimal))
              )

              return {
                key: pricePool.asset.chain,
                asset,
                priceAsset: pricePool.asset,
                deposit: { amount: depositValue, price: depositPrice },
                redeem: { amount: redeemValue, price: redeemPrice },
                percent: growthPercent
              }
            }
          )
        )
      })
      .filter((item): item is AssetProps => item !== null)

    setAssetDetailsArray(assetDetails)
  }, [allSaverProviders, network, poolsStateRD, pricePool])

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
      <SaversDetailsTable assetDetails={assetDetailsArray} />
    </div>
  )
}
