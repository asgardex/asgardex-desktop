import { useCallback, useEffect, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useMidgardContext } from '../contexts/MidgardContext'
import { GetDepthHistoryIntervalEnum } from '../services/midgard/midgardTypes'
import type { PriceLevel } from '../views/pools/detail/types'

const POLL_INTERVAL_MS = 30_000

type Params = {
  poolAsset: AnyAsset | null
  priceLevels: PriceLevel[]
  enabled: boolean
  onCrossing: (levelId: string, currentPrice: number) => void
}

export const usePriceLevelMonitor = ({ poolAsset, priceLevels, enabled, onCrossing }: Params) => {
  const {
    service: {
      pools: { apiGetDepthHistory$ }
    }
  } = useMidgardContext()

  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const prevPriceRef = useRef<number | null>(null)

  // Keep refs to avoid stale closures in interval
  const priceLevelsRef = useRef(priceLevels)
  priceLevelsRef.current = priceLevels

  const onCrossingRef = useRef(onCrossing)
  onCrossingRef.current = onCrossing

  const fetchPrice = useCallback(() => {
    if (!poolAsset) return Rx.EMPTY

    return FP.pipe(
      apiGetDepthHistory$({ poolAsset, interval: GetDepthHistoryIntervalEnum.Hour, count: 1 }),
      RxOp.map((rd) =>
        FP.pipe(
          rd,
          RD.map((history) => {
            const latest = history.intervals[history.intervals.length - 1]
            return latest ? parseFloat(latest.assetPriceUSD) : null
          })
        )
      ),
      RxOp.map((rd) => (RD.isSuccess(rd) ? rd.value : null))
    )
  }, [poolAsset, apiGetDepthHistory$])

  useEffect(() => {
    if (!enabled || !poolAsset) return

    const subRef = { current: null as Rx.Subscription | null }

    const poll = () => {
      subRef.current?.unsubscribe()
      subRef.current = fetchPrice().subscribe((price) => {
        if (price === null) return

        setCurrentPrice(price)
        const prevPrice = prevPriceRef.current

        if (prevPrice !== null) {
          const levels = priceLevelsRef.current.filter((l) => l.status === 'pending')
          for (const level of levels) {
            const crossed =
              level.type === 'buy'
                ? prevPrice > level.price && price <= level.price
                : prevPrice < level.price && price >= level.price
            if (crossed) {
              onCrossingRef.current(level.id, price)
            }
          }
        }

        prevPriceRef.current = price
      })
    }

    // Initial fetch
    poll()
    const intervalId = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
      subRef.current?.unsubscribe()
    }
    // Re-create interval when pool asset changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, poolAsset ? assetToString(poolAsset) : '', fetchPrice])

  return { currentPrice }
}
