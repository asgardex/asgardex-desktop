import { useCallback, useEffect, useState } from 'react'

/**
 * Streaming modes for swap execution:
 * 0 = Rapid  — interval 0, multiple sub-swaps per block (THORChain only)
 * 1 = Fast   — interval 1, one sub-swap per block
 * 2 = Balanced — interval 2
 * 3 = Best Price — interval 3
 */
export type StreamingMode = 0 | 1 | 2 | 3

const MODE_TO_INTERVAL: Record<StreamingMode, number> = {
  0: 0, // Rapid
  1: 1, // Fast
  2: 2, // Balanced
  3: 3 // Best Price
}

const RAPID_DEFAULT: StreamingMode = 0
const STREAMING_DEFAULT: StreamingMode = 1

export type UseStreamingParamsReturn = {
  streamingInterval: number
  streamingQuantity: number
  isStreaming: boolean
  activeMode: StreamingMode
  setMode: (mode: StreamingMode) => void
  setQuantity: (quantity: number) => void
  resetToDefault: () => void
  supportRapid: boolean
}

export const useStreamingParams = (supportRapid = true): UseStreamingParamsReturn => {
  const defaultMode = supportRapid ? RAPID_DEFAULT : STREAMING_DEFAULT

  const [activeMode, setActiveMode] = useState<StreamingMode>(defaultMode)
  const [streamingInterval, setStreamingInterval] = useState<number>(MODE_TO_INTERVAL[defaultMode])
  const [streamingQuantity, setStreamingQuantity] = useState<number>(0)

  // Reset to appropriate default when supportRapid changes (e.g. switching protocols)
  useEffect(() => {
    const newDefault = supportRapid ? RAPID_DEFAULT : STREAMING_DEFAULT
    // If current mode is Rapid but rapid is no longer supported, switch to streaming default
    if (!supportRapid && activeMode === 0) {
      setActiveMode(newDefault)
      setStreamingInterval(MODE_TO_INTERVAL[newDefault])
      setStreamingQuantity(0)
    }
  }, [supportRapid, activeMode])

  const setMode = useCallback((mode: StreamingMode) => {
    setActiveMode(mode)
    setStreamingInterval(MODE_TO_INTERVAL[mode])
    setStreamingQuantity(0)
  }, [])

  const setQuantity = useCallback((quantity: number) => {
    setStreamingQuantity(quantity)
  }, [])

  const resetToDefault = useCallback(() => {
    const mode = supportRapid ? RAPID_DEFAULT : STREAMING_DEFAULT
    setActiveMode(mode)
    setStreamingInterval(MODE_TO_INTERVAL[mode])
    setStreamingQuantity(0)
  }, [supportRapid])

  return {
    streamingInterval,
    streamingQuantity,
    isStreaming: true, // Always streaming (Limit mode removed)
    activeMode,
    setMode,
    setQuantity,
    resetToDefault,
    supportRapid
  }
}
