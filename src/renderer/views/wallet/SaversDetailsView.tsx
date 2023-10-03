import React, { useCallback, useEffect, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Asset, BaseAmount, baseAmount, Chain } from '@xchainjs/xchain-util'
import { Row } from 'antd'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { from } from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ENABLED_CHAINS } from '../../../shared/utils/chain'
import { SaversDetailsTable } from '../../components/savers/SaversDetailsTable'
import { RefreshButton } from '../../components/uielements/button'
import { AssetsNav } from '../../components/wallet/assets'
import { useChainContext } from '../../contexts/ChainContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { getChainAsset } from '../../helpers/chainHelper'
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

  useEffect(() => {
    const subscriptions = ENABLED_CHAINS.map((chain) => {
      const asset = getChainAsset(chain)
      return addressByChain$(chain)
        .pipe(
          RxOp.map(addressFromOptionalWalletAddress),
          RxOp.switchMap((addressOpt) => {
            if (O.isSome(addressOpt)) {
              const address = addressOpt.value
              return getSaverProvider$(asset, address)
            }
            // return an observable that emits `null` or some default value
            return from([null])
          })
        )
        .subscribe((saverProvider) => {
          if (saverProvider !== null) {
            setAllSaverProviders((prev) => ({ ...prev, [chain]: saverProvider }))
          }
        })
    })

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe())
    }
  }, [addressByChain$, getSaverProvider$])

  useEffect(() => {
    const assetDetails: AssetProps[] = Object.keys(allSaverProviders)
      .map((chain) => {
        const saverProviderRD = allSaverProviders[chain]
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
              const asset = getChainAsset(chain)
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
