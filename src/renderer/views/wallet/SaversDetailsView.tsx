import React, { useCallback, useEffect, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { baseAmount } from '@xchainjs/xchain-util'
import { Row } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { ENABLED_CHAINS } from '../../../shared/utils/chain'
import { SaversDetails } from '../../components/savers/SaversDetails'
import { ErrorView } from '../../components/shared/error'
import { Spin } from '../../components/shared/loading'
import { FlatButton, RefreshButton } from '../../components/uielements/button'
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

export const SaversDetailsView: React.FC = (): JSX.Element => {
  const intl = useIntl()

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

  const [cachedSaverProviders, setCachedSaverProviders] = useState<Record<string, SaverProviderRD>>({})
  const [allSaverProviders, setAllSaverProviders] = useState<Record<string, SaverProviderRD>>({}) // to store the SaverProviderRD for each chain

  useEffect(() => {
    if (Object.keys(cachedSaverProviders).length === 0) {
      const subscriptions = ENABLED_CHAINS.map((chain) => {
        const asset = getChainAsset(chain)
        return addressByChain$(chain)
          .pipe(RxOp.map(addressFromOptionalWalletAddress))
          .subscribe((addressOpt) => {
            if (O.isSome(addressOpt)) {
              const address = addressOpt.value
              // Assuming `getSaverProvider$` can work with other chains as well, not just THORChain.
              const subscription = getSaverProvider$(asset, address).subscribe((saverProvider) => {
                setCachedSaverProviders((prev) => ({ ...prev, [chain]: saverProvider }))
              })
              return subscription
            }
          })
      })
      // Cleanup
      return () => {
        subscriptions.forEach((sub) => sub.unsubscribe())
      }
    } else {
      setAllSaverProviders(cachedSaverProviders) // use cached data
    }
  }, [addressByChain$, cachedSaverProviders, getSaverProvider$])

  const renderLoading = () => (
    <div className="flex h-full w-full items-center justify-center">
      <Spin size="default" />,
    </div>
  )
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
      {Object.keys(allSaverProviders).map((chain) => {
        const saverProviderRD = allSaverProviders[chain]
        return FP.pipe(
          sequenceTRD(poolsStateRD, saverProviderRD),
          RD.fold(
            () => renderLoading(),
            () => renderLoading(),
            (error) => (
              <ErrorView
                title={intl.formatMessage({ id: 'common.error' })}
                subTitle={error?.message ?? error.toString()}
                extra={
                  <FlatButton onClick={reloadSaverProvider}>{intl.formatMessage({ id: 'common.retry' })}</FlatButton>
                }
              />
            ),
            ([{ poolDetails }, { depositValue, redeemValue, growthPercent }]) => {
              if (depositValue.amount().isZero() && redeemValue.amount().isZero()) {
                return null // Skip rendering if both depositValue and redeemValue are zero
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
              return (
                <>
                  <SaversDetails
                    key={chain}
                    asset={asset}
                    priceAsset={pricePool.asset}
                    deposit={{ amount: depositValue, price: depositPrice }}
                    redeem={{ amount: redeemValue, price: redeemPrice }}
                    percent={growthPercent}
                  />
                </>
              )
            }
          )
        )
      })}
    </div>
  )
}
