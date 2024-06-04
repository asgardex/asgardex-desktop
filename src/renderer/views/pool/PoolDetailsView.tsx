import React, { useCallback, useEffect, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useParams } from 'react-router-dom'

import { PoolDetails, Props as PoolDetailProps } from '../../components/pool/PoolDetails'
import { PoolDetails as PoolDetailsMaya, Props as PoolDetailPropsMaya } from '../../components/pool/PoolDetailsMaya'
import { ErrorView } from '../../components/shared/error'
import { RefreshButton } from '../../components/uielements/button'
import { DEFAULT_GET_POOLS_PERIOD, ONE_BN } from '../../const'
import { useAppContext } from '../../contexts/AppContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { getAssetFromNullableString } from '../../helpers/assetHelper'
import { eqAsset } from '../../helpers/fp/eq'
import { useDex } from '../../hooks/useDex'
import { useMidgardHistoryActions } from '../../hooks/useMidgardHistoryActions'
import { useMidgardMayaHistoryActions } from '../../hooks/useMidgardMayaHistoryActions'
import { usePoolWatchlist } from '../../hooks/usePoolWatchlist'
import { PoolDetailRouteParams } from '../../routes/pools/detail'
import { DEFAULT_NETWORK } from '../../services/const'
import {
  PoolDetailRD as PoolDetailMayaRD,
  PoolStatsDetailRD as PoolStatsDetailMayaRD
} from '../../services/mayaMigard/types'
import { PoolDetailRD, PoolStatsDetailRD } from '../../services/midgard/types'
import { PoolChartView } from './PoolChartView'
import { PoolChartViewMaya } from './PoolChartViewMaya'
import * as Styled from './PoolDetailsView.styles'
import { PoolHistoryView } from './PoolHistoryView'

type TargetPoolDetailProps = Omit<
  PoolDetailProps,
  | 'asset'
  | 'historyActions'
  | 'reloadPoolDetail'
  | 'reloadPoolStatsDetail'
  | 'watched'
  | 'watch'
  | 'unwatch'
  | 'setPoolsPeriod'
>
type TargetPoolDetailPropsMaya = Omit<
  PoolDetailPropsMaya,
  | 'asset'
  | 'historyActions'
  | 'reloadPoolDetail'
  | 'reloadPoolStatsDetail'
  | 'watched'
  | 'watch'
  | 'unwatch'
  | 'setPoolsPeriod'
>
const defaultDetailsProps: TargetPoolDetailProps = {
  priceRatio: ONE_BN,
  HistoryView: PoolHistoryView,
  ChartView: PoolChartView,
  poolDetail: RD.initial,
  poolStatsDetail: RD.initial,
  priceSymbol: '',
  network: DEFAULT_NETWORK,
  poolsPeriod: DEFAULT_GET_POOLS_PERIOD
}
const defaultDetailsPropsMaya: TargetPoolDetailPropsMaya = {
  priceRatio: ONE_BN,
  HistoryView: PoolHistoryView,
  ChartView: PoolChartViewMaya,
  poolDetail: RD.initial,
  poolStatsDetail: RD.initial,
  priceSymbol: '',
  network: DEFAULT_NETWORK,
  poolsPeriod: DEFAULT_GET_POOLS_PERIOD
}

export const PoolDetailsView: React.FC = () => {
  const { network$ } = useAppContext()

  const { dex } = useDex()
  const {
    service: {
      reloadChartDataUI: reloadChartDataUIThor,
      pools: {
        selectedPoolDetail$: selectedPoolDetailThor$,
        priceRatio$,
        selectedPricePoolAssetSymbol$,
        poolStatsDetail$,
        reloadPoolStatsDetail,
        reloadSelectedPoolDetail,
        poolsPeriod$,
        setPoolsPeriod: setPoolsPeriodThor
      },
      setSelectedPoolAsset: setSelectedPoolAssetThor
    }
  } = useMidgardContext()

  const {
    service: {
      reloadChartDataUI: reloadChartDataUIMaya,
      pools: {
        selectedPoolDetail$: selectedPoolDetailMaya$,
        priceRatio$: priceRatioMaya$,
        selectedPricePoolAssetSymbol$: selectedPricePoolAssetSymbolMaya$,
        poolStatsDetail$: poolStatsDetailMaya$,
        reloadPoolStatsDetail: reloadPoolStatsDetailMaya,
        reloadSelectedPoolDetail: reloadSelectedPoolDetailMaya,
        poolsPeriod$: poolsPeriodMaya$,
        setPoolsPeriod: setPoolsPeriodMaya
      },
      setSelectedPoolAsset: setSelectedPoolAssetMaya
    }
  } = useMidgardMayaContext()

  const network = useObservableState(network$, DEFAULT_NETWORK)

  const intl = useIntl()

  const { asset } = useParams<PoolDetailRouteParams>()

  const { add: addToWatchList, remove: removeFromWatchList, list: watchedList } = usePoolWatchlist() //tbf

  const poolsPeriod = useObservableState(
    dex.chain === 'THOR' ? poolsPeriod$ : poolsPeriodMaya$,
    DEFAULT_GET_POOLS_PERIOD
  )

  const oRouteAsset = useMemo(() => getAssetFromNullableString(asset), [asset])

  // Set selected pool asset whenever an asset in route has been changed
  // Needed to get all data for this pool (pool details etc.)
  useEffect(() => {
    if (dex.chain === 'THOR') {
      setSelectedPoolAssetThor(oRouteAsset)
      // Reset selectedPoolAsset on view's unmount to avoid effects with depending streams
      return () => {
        setSelectedPoolAssetThor(O.none)
      }
    } else {
      setSelectedPoolAssetMaya(oRouteAsset)
      // Reset selectedPoolAsset on view's unmount to avoid effects with depending streams
      return () => {
        setSelectedPoolAssetMaya(O.none)
      }
    }
  }, [dex, oRouteAsset, setSelectedPoolAssetMaya, setSelectedPoolAssetThor])

  const oPriceSymbol = useObservableState(
    dex.chain === 'THOR' ? selectedPricePoolAssetSymbol$ : selectedPricePoolAssetSymbolMaya$,
    O.none
  )
  const priceSymbol = FP.pipe(
    oPriceSymbol,
    O.getOrElse(() => '')
  )

  const priceRatio = useObservableState(dex.chain === 'THOR' ? priceRatio$ : priceRatioMaya$, ONE_BN)

  const historyActions = useMidgardHistoryActions()
  const historyActionsMaya = useMidgardMayaHistoryActions()

  const { historyPage: historyPageRD, reloadHistory } = historyActions
  const { historyPage: historyPageMayaRD, reloadHistory: reloadHistoryMaya } = historyActionsMaya

  const poolDetailThorRD: PoolDetailRD = useObservableState(selectedPoolDetailThor$, RD.initial)
  const poolDetailMayaRD: PoolDetailMayaRD = useObservableState(selectedPoolDetailMaya$, RD.initial)

  const poolStatsDetailThorRD: PoolStatsDetailRD = useObservableState(poolStatsDetail$, RD.initial)
  const poolStatsDetailMayaRD: PoolStatsDetailMayaRD = useObservableState(poolStatsDetailMaya$, RD.initial)

  const onRefreshData = useCallback(() => {
    // trigger reload of chart data, which will be handled in PoolChartView

    if (dex.chain === 'THOR') {
      reloadHistory()
      reloadSelectedPoolDetail()
      reloadPoolStatsDetail()
      reloadChartDataUIThor()
    } else {
      reloadHistoryMaya()
      reloadPoolStatsDetailMaya()
      reloadSelectedPoolDetailMaya()
      reloadChartDataUIMaya()
    }
  }, [
    dex,
    reloadChartDataUIMaya,
    reloadChartDataUIThor,
    reloadHistory,
    reloadHistoryMaya,
    reloadPoolStatsDetail,
    reloadPoolStatsDetailMaya,
    reloadSelectedPoolDetail,
    reloadSelectedPoolDetailMaya
  ])

  const refreshButtonDisabled = useMemo(() => {
    return (
      FP.pipe(historyPageRD || historyPageMayaRD, RD.isPending) ||
      FP.pipe(dex.chain === 'THOR' ? poolDetailThorRD : poolDetailMayaRD, RD.isPending)
    )
  }, [dex, historyPageMayaRD, historyPageRD, poolDetailMayaRD, poolDetailThorRD])

  const prevProps = useRef<TargetPoolDetailProps>(defaultDetailsProps)
  const prevPropsMaya = useRef<TargetPoolDetailPropsMaya>(defaultDetailsPropsMaya)

  return (
    <>
      <Styled.ControlsContainer>
        <Styled.BackLink />
        <RefreshButton onClick={onRefreshData} disabled={refreshButtonDisabled} />
      </Styled.ControlsContainer>
      {FP.pipe(
        oRouteAsset,
        O.fold(
          () => <ErrorView title={intl.formatMessage({ id: 'routes.invalid.asset' }, { asset })} />,
          (asset) => {
            prevProps.current = {
              network,
              priceRatio,
              poolDetail: poolDetailThorRD,
              poolStatsDetail: poolStatsDetailThorRD,
              priceSymbol,
              HistoryView: PoolHistoryView,
              ChartView: PoolChartView,
              poolsPeriod
            }
            prevPropsMaya.current = {
              network,
              priceRatio,
              poolDetail: poolDetailMayaRD,
              poolStatsDetail: poolStatsDetailMayaRD,
              priceSymbol,
              HistoryView: PoolHistoryView,
              ChartView: PoolChartViewMaya,
              poolsPeriod
            }
            const watched = FP.pipe(watchedList, A.elem(eqAsset)(asset))

            return dex.chain === 'THOR' ? (
              <PoolDetails
                asset={asset}
                watched={watched}
                watch={() => addToWatchList(asset)}
                unwatch={() => removeFromWatchList(asset)}
                historyActions={historyActions}
                reloadPoolDetail={reloadSelectedPoolDetail}
                reloadPoolStatsDetail={reloadPoolStatsDetail}
                setPoolsPeriod={setPoolsPeriodThor}
                {...prevProps.current}
              />
            ) : (
              <PoolDetailsMaya
                asset={asset}
                watched={watched}
                watch={() => addToWatchList(asset)}
                unwatch={() => removeFromWatchList(asset)}
                historyActions={historyActionsMaya}
                reloadPoolDetail={reloadSelectedPoolDetail}
                reloadPoolStatsDetail={reloadPoolStatsDetail}
                setPoolsPeriod={setPoolsPeriodMaya}
                {...prevPropsMaya.current}
              />
            )
          }
        )
      )}
    </>
  )
}
