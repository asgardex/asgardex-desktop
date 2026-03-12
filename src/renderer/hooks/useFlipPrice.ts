import { useCallback, useEffect, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import axios from 'axios'

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=chainflip&vs_currencies=usd'
const CACHE_DURATION_MS = 10 * 60 * 1000 // 10 minutes

export const useFlipPrice = () => {
  const [flipPriceRD, setFlipPriceRD] = useState<RD.RemoteData<Error, string>>(RD.pending)
  const lastFetchedAt = useRef<number>(0)
  const cachedPrice = useRef<string | null>(null)

  const fetchFlipPrice = useCallback(async () => {
    const now = Date.now()
    if (cachedPrice.current && now - lastFetchedAt.current < CACHE_DURATION_MS) {
      setFlipPriceRD(RD.success(cachedPrice.current))
      return
    }

    try {
      setFlipPriceRD((prev) => (RD.isSuccess(prev) ? prev : RD.pending))
      const { data } = await axios.get(COINGECKO_URL)
      const price = data?.chainflip?.usd ?? 0
      const label = `$${price.toFixed(2)}`
      cachedPrice.current = label
      lastFetchedAt.current = now
      setFlipPriceRD(RD.success(label))
    } catch (error) {
      if (!cachedPrice.current) {
        setFlipPriceRD(RD.failure(error instanceof Error ? error : new Error('Failed to fetch FLIP price')))
      }
      // Keep showing cached price on error
    }
  }, [])

  useEffect(() => {
    fetchFlipPrice()
  }, [fetchFlipPrice])

  const reloadFlipPrice = useCallback(() => {
    lastFetchedAt.current = 0 // force refresh
    fetchFlipPrice()
  }, [fetchFlipPrice])

  return { flipPriceRD, reloadFlipPrice }
}
