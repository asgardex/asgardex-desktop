import { useCallback, useEffect, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'

const RETRY_DELAYS_MS = [3_000, 6_000, 12_000]

export const RUNEBOND_RELOAD_DELAYS_MS = [15_000, 30_000, 60_000, 120_000]

export type ReloadUntil<T> = (settled: (value: T) => boolean) => void

export const useReloadUntil = <T>(
  dataRD: RD.RemoteData<Error, T>,
  reload: () => void,
  retry: () => void = reload,
  delaysMs: number[] = RETRY_DELAYS_MS
): ReloadUntil<T> => {
  const pending = useRef<{ settled: (value: T) => boolean; attempt: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const delays = useRef(delaysMs)
  delays.current = delaysMs

  useEffect(() => {
    const current = pending.current
    if (!current || !RD.isSuccess(dataRD)) return
    if (current.settled(dataRD.value) || current.attempt >= delays.current.length) {
      pending.current = null
      return
    }
    const delay = delays.current[current.attempt]
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
