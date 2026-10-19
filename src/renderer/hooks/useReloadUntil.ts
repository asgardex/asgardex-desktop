import { useCallback, useEffect, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'

const RETRY_DELAYS_MS = [3_000, 6_000, 12_000]

export type ReloadUntil<T> = (settled: (value: T) => boolean) => void

export const useReloadUntil = <T>(
  dataRD: RD.RemoteData<Error, T>,
  reload: () => void,
  retry: () => void = reload
): ReloadUntil<T> => {
  const pending = useRef<{ settled: (value: T) => boolean; attempt: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const current = pending.current
    if (!current || !RD.isSuccess(dataRD)) return
    if (current.settled(dataRD.value) || current.attempt >= RETRY_DELAYS_MS.length) {
      pending.current = null
      return
    }
    const delay = RETRY_DELAYS_MS[current.attempt]
    current.attempt += 1
    timer.current = window.setTimeout(retry, delay)
  }, [dataRD, retry])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return useCallback(
    (settled: (value: T) => boolean) => {
      window.clearTimeout(timer.current)
      pending.current = { settled, attempt: 0 }
      reload()
    },
    [reload]
  )
}
