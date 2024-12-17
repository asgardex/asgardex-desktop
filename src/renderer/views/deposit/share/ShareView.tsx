import React, { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { PoolDetail as PoolDetailMaya } from '@xchainjs/xchain-mayamidgard'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { THORCHAIN_DECIMAL } from '@xchainjs/xchain-thorchain-query'
import { AnyAsset, BaseAmount, Chain } from '@xchainjs/xchain-util'
import { Spin } from 'antd'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { EmptyResult } from '../../../components/shared/result/EmptyResult'
import { PoolShare as PoolShareUI } from '../../../components/uielements/poolShare'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { to1e8BaseAmount } from '../../../helpers/assetHelper'
import { RUNE_PRICE_POOL } from '../../../helpers/poolHelper'
import { MAYA_PRICE_POOL } from '../../../helpers/poolHelperMaya'
import * as ShareHelpers from '../../../helpers/poolShareHelper'
import {
  PoolDetailRD as PoolDetailMayaRD,
  PoolShareRD as PoolShareMayaRD,
  PoolShare as PoolShareMaya
} from '../../../services/mayaMigard/types'
import { PoolDetailRD, PoolShareRD, PoolShare } from '../../../services/midgard/types'
import { toPoolData } from '../../../services/midgard/utils'
import { AssetWithDecimal } from '../../../types/asgardex'
import { getValueOfAsset1InAsset2, getValueOfRuneInAsset } from '../../pools/Pools.utils'

export type ShareViewProps = {
  protocol: Chain
  asset: AssetWithDecimal
  poolShare: PoolShareRD | PoolShareMayaRD
  poolDetail: PoolDetailRD | PoolDetailMayaRD
  smallWidth?: boolean
}

export const ShareView = ({
  protocol,
  asset: assetWD,
  poolShare: poolShareRD,
  smallWidth,
  poolDetail: poolDetailRD
}: ShareViewProps) => {
  const { service: midgardService } = useMidgardContext()
  const { service: midgardMayaService } = useMidgardMayaContext()
  const {
    pools: { selectedPricePoolAsset$: selectedPricePoolAssetThor$, selectedPricePool$: selectedPricePoolThor$ }
  } = midgardService

  const {
    pools: { selectedPricePoolAsset$: selectedPricePoolAssetMaya$, selectedPricePool$: selectedPricePoolMaya$ }
  } = midgardMayaService

  const selectedPricePoolAsset$ = protocol === THORChain ? selectedPricePoolAssetThor$ : selectedPricePoolAssetMaya$
  const selectedPricePool$ = protocol === THORChain ? selectedPricePoolThor$ : selectedPricePoolMaya$

  const intl = useIntl()

  const oPriceAsset = useObservableState<O.Option<AnyAsset>>(selectedPricePoolAsset$, O.none)

  const { poolData: pricePoolData } = useObservableState(
    selectedPricePool$,
    protocol === THORChain ? RUNE_PRICE_POOL : MAYA_PRICE_POOL
  )

  const renderPoolShareReady = useCallback(
    ({ units, runeAddress, assetAddress }: PoolShare | PoolShareMaya, poolDetail: PoolDetail | PoolDetailMaya) => {
      const runeShare: BaseAmount = ShareHelpers.getRuneShare(
        units,
        poolDetail,
        protocol === THORChain ? THORCHAIN_DECIMAL : CACAO_DECIMAL
      )
      const assetShare: BaseAmount = ShareHelpers.getAssetShare({
        liquidityUnits: units,
        detail: poolDetail,
        assetDecimal: assetWD.decimal
      })
      const poolShare: BigNumber = ShareHelpers.getPoolShare(units, poolDetail)
      const poolData = toPoolData(poolDetail)

      const assetPrice: BaseAmount = getValueOfAsset1InAsset2(
        // Note: `assetShare` needs to be converted to 1e8,
        // since it based on asset decimal, which might be different
        to1e8BaseAmount(assetShare),
        poolData,
        pricePoolData
      )
      const runePrice: BaseAmount = getValueOfRuneInAsset(runeShare, pricePoolData)

      return (
        <PoolShareUI
          asset={assetWD}
          poolShare={poolShare}
          depositUnits={units}
          shares={{ rune: runeShare, asset: assetShare }}
          priceAsset={O.toUndefined(oPriceAsset)}
          loading={false}
          assetPrice={assetPrice}
          runePrice={runePrice}
          smallWidth={smallWidth}
          addresses={{ rune: runeAddress, asset: assetAddress }}
          protocol={protocol}
        />
      )
    },
    [assetWD, protocol, oPriceAsset, pricePoolData, smallWidth]
  )

  const renderNoShare = useMemo(
    () => (
      <EmptyResult
        title={intl.formatMessage({
          id: 'deposit.pool.noShares'
        })}
      />
    ),
    [intl]
  )

  const renderPoolShare = useMemo(
    () =>
      FP.pipe(
        RD.combine(poolShareRD, poolDetailRD),
        RD.fold(
          () => renderNoShare,
          () => <Spin size="large" />,
          () => renderNoShare,
          ([oPoolShare, pool]) =>
            FP.pipe(
              oPoolShare,
              O.fold(
                () => renderNoShare,
                (poolShare) => renderPoolShareReady(poolShare, pool)
              )
            )
        )
      ),

    [poolShareRD, poolDetailRD, renderNoShare, renderPoolShareReady]
  )

  return renderPoolShare
}
